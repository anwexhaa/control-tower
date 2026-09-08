import { EXCEPTION_DEFS } from "../../domain/exceptions";
import { FREE_TIME_HOURS } from "../../domain/exceptions";
import { IST_OFFSET_MS } from "../../domain/documents";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { TRANSPORTERS } from "../../domain/transporters";
import type { ExceptionCode, Trip, TripState } from "../../domain/types";

/* Everything Pulse shows is computed here, on demand, from the live board.

   Nothing is precomputed and nothing is cached: the numbers are a function of
   the same trips and states the control tower is reading, so the two screens
   cannot drift apart. The whole set recomputes in a couple of milliseconds.

   Note on the plan: the spec said these aggregates should derive from the event
   log. They do not, and should not — the log is a capped tail of the last 2,000
   events, so it is the wrong source for a fleet-wide total. Live state is both
   complete and cheaper. */

const H = 3_600_000;

/** Indicative demurrage, applied to hours beyond contracted free time. */
export const DETENTION_RATE_INR_PER_HOUR = 150;

/** What the network is held to. Above it is good, below it is not. */
export const ON_TIME_TARGET_PCT = 90;

function istDayIndex(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / 86_400_000);
}

/* ------------------------------------------------------ transporter table --- */

export interface TransporterRow {
  code: string;
  name: string;
  /** Everything on the board for this carrier. */
  trips: number;
  delivered: number;
  atRisk: number;
  /** Measured on-time delivery, or null when nothing has landed yet. */
  onTimePct: number | null;
  /** What they are contracted to hold. */
  contractedPct: number;
  /** Measured against contracted. Negative is underperforming. */
  deltaPct: number | null;
  avgDelayH: number;
  detentionH: number;
  exceptionsPerTrip: number;
}

export function transporterScorecard(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
): TransporterRow[] {
  const acc = new Map<
    string,
    { trips: number; delivered: number; onTime: number; atRisk: number; delayH: number; late: number; detentionH: number; exceptions: number }
  >();

  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s) continue;

    let row = acc.get(trip.transporterCode);
    if (!row) {
      row = { trips: 0, delivered: 0, onTime: 0, atRisk: 0, delayH: 0, late: 0, detentionH: 0, exceptions: 0 };
      acc.set(trip.transporterCode, row);
    }

    row.trips++;
    row.exceptions += s.exceptions.length;
    if (s.status === "at_risk") row.atRisk++;
    if (s.delayHours > 0) {
      row.delayH += s.delayHours;
      row.late++;
    }

    // Detention only counts beyond the contracted free period — the hours
    // inside it were bought and paid for.
    row.detentionH += Math.max(0, trip.detentionOriginH - FREE_TIME_HOURS.origin);
    if (s.status === "delivered") {
      row.delivered++;
      row.detentionH += Math.max(0, trip.detentionDestH - FREE_TIME_HOURS.destination);
      if (s.arrivedAt !== null && s.arrivedAt <= trip.slaCommitAt) row.onTime++;
    }
  }

  const rows: TransporterRow[] = [];
  for (const t of TRANSPORTERS) {
    const a = acc.get(t.code);
    if (!a || a.trips === 0) continue;

    const onTimePct = a.delivered > 0 ? (a.onTime / a.delivered) * 100 : null;
    rows.push({
      code: t.code,
      name: t.name,
      trips: a.trips,
      delivered: a.delivered,
      atRisk: a.atRisk,
      onTimePct,
      contractedPct: t.onTimePct,
      deltaPct: onTimePct === null ? null : onTimePct - t.onTimePct,
      avgDelayH: a.late > 0 ? a.delayH / a.late : 0,
      detentionH: a.detentionH,
      exceptionsPerTrip: a.trips > 0 ? a.exceptions / a.trips : 0,
    });
  }

  return rows;
}

/* ------------------------------------------------------------- lane heat --- */

export interface HeatBucket {
  /** Start of the window, in sim time. */
  at: number;
  label: string;
}

export interface HeatRow {
  laneId: string;
  label: string;
  volume: number;
  /** One cell per bucket; null where nothing was delivered in that window. */
  cells: Array<{ onTimePct: number | null; delivered: number }>;
}

/**
 * Corridors against recent windows.
 *
 * The plan called for weeks. The simulated board only carries about thirty
 * hours of completed trips, so weekly columns would be one column of data and
 * six of nothing. Four-hour blocks over the last day is what the data can
 * actually support, and it happens to be the window a shift lead works in.
 */
export function laneHeat(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  now: number,
  bucketHours = 4,
  bucketCount = 6,
  topLanes = 12,
): { buckets: HeatBucket[]; rows: HeatRow[] } {
  const bucketMs = bucketHours * H;
  const end = Math.ceil(now / bucketMs) * bucketMs;
  const start = end - bucketCount * bucketMs;

  const buckets: HeatBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const at = start + i * bucketMs;
    const istHour = Math.floor((((at + IST_OFFSET_MS) % 86_400_000) + 86_400_000) % 86_400_000 / H);
    return { at, label: `${String(istHour).padStart(2, "0")}:00` };
  });

  const byLane = new Map<string, { volume: number; cells: Array<{ onTime: number; delivered: number }> }>();

  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s) continue;

    let row = byLane.get(trip.laneId);
    if (!row) {
      row = {
        volume: 0,
        cells: Array.from({ length: bucketCount }, () => ({ onTime: 0, delivered: 0 })),
      };
      byLane.set(trip.laneId, row);
    }
    row.volume++;

    if (s.status !== "delivered" || s.arrivedAt === null) continue;
    if (s.arrivedAt < start || s.arrivedAt >= end) continue;

    const index = Math.min(bucketCount - 1, Math.floor((s.arrivedAt - start) / bucketMs));
    row.cells[index].delivered++;
    if (s.arrivedAt <= trip.slaCommitAt) row.cells[index].onTime++;
  }

  const rows: HeatRow[] = [...byLane.entries()]
    .map(([laneId, row]) => ({
      laneId,
      label: LANE_BY_ID.has(laneId) ? laneLabel(LANE_BY_ID.get(laneId)!) : laneId,
      volume: row.volume,
      cells: row.cells.map((c) => ({
        delivered: c.delivered,
        onTimePct: c.delivered > 0 ? (c.onTime / c.delivered) * 100 : null,
      })),
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, topLanes);

  return { buckets, rows };
}

/* ---------------------------------------------------------------- pareto --- */

export interface ParetoRow {
  code: ExceptionCode;
  label: string;
  count: number;
  sharePct: number;
  cumulativePct: number;
}

/**
 * Which conditions account for most of what the tower is dealing with.
 *
 * Counts every exception raised against the board, open or closed, because a
 * problem that keeps clearing itself is still consuming attention.
 */
export function delayPareto(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
): ParetoRow[] {
  const counts = new Map<ExceptionCode, number>();
  let total = 0;

  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s) continue;
    for (const e of s.exceptions) {
      counts.set(e.code, (counts.get(e.code) ?? 0) + 1);
      total++;
    }
  }
  if (total === 0) return [];

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  let running = 0;

  return sorted.map(([code, count]) => {
    running += count;
    return {
      code,
      label: EXCEPTION_DEFS[code].label,
      count,
      sharePct: (count / total) * 100,
      cumulativePct: (running / total) * 100,
    };
  });
}

/* ------------------------------------------------------------------ cost --- */

export interface CostRow {
  laneId: string;
  label: string;
  trips: number;
  distanceKm: number;
  freightInr: number;
  /** Freight divided by billed tonne-kilometres — the unit freight is judged on. */
  costPerBtkm: number;
  costPerMt: number;
  detentionCostInr: number;
}

export function costByLane(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  topLanes = 12,
): CostRow[] {
  const acc = new Map<
    string,
    { trips: number; freight: number; btkm: number; tonnes: number; detentionH: number }
  >();

  for (const trip of trips) {
    if (!states.has(trip.id)) continue;
    const lane = LANE_BY_ID.get(trip.laneId);
    if (!lane) continue;

    let row = acc.get(trip.laneId);
    if (!row) {
      row = { trips: 0, freight: 0, btkm: 0, tonnes: 0, detentionH: 0 };
      acc.set(trip.laneId, row);
    }

    row.trips++;
    row.freight += trip.freightInr;
    row.btkm += trip.weightMt * lane.distanceKm;
    row.tonnes += trip.weightMt;
    row.detentionH +=
      Math.max(0, trip.detentionOriginH - FREE_TIME_HOURS.origin) +
      Math.max(0, trip.detentionDestH - FREE_TIME_HOURS.destination);
  }

  return [...acc.entries()]
    .map(([laneId, a]) => {
      const lane = LANE_BY_ID.get(laneId)!;
      return {
        laneId,
        label: laneLabel(lane),
        trips: a.trips,
        distanceKm: lane.distanceKm,
        freightInr: a.freight,
        costPerBtkm: a.btkm > 0 ? a.freight / a.btkm : 0,
        costPerMt: a.tonnes > 0 ? a.freight / a.tonnes : 0,
        detentionCostInr: a.detentionH * DETENTION_RATE_INR_PER_HOUR,
      };
    })
    .sort((a, b) => b.costPerBtkm - a.costPerBtkm)
    .slice(0, topLanes);
}

/* --------------------------------------------------------------- headline --- */

export interface PulseHeadline {
  deliveredWindow: number;
  onTimePct: number | null;
  totalFreightInr: number;
  detentionCostInr: number;
  medianCostPerBtkm: number;
}

export function headline(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  now: number,
): PulseHeadline {
  const today = istDayIndex(now);
  let delivered = 0;
  let onTime = 0;
  let freight = 0;
  let detentionH = 0;
  const perBtkm: number[] = [];

  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s) continue;
    const lane = LANE_BY_ID.get(trip.laneId);
    if (!lane) continue;

    freight += trip.freightInr;
    detentionH +=
      Math.max(0, trip.detentionOriginH - FREE_TIME_HOURS.origin) +
      Math.max(0, trip.detentionDestH - FREE_TIME_HOURS.destination);

    const btkm = trip.weightMt * lane.distanceKm;
    if (btkm > 0) perBtkm.push(trip.freightInr / btkm);

    if (s.status === "delivered" && s.arrivedAt !== null && istDayIndex(s.arrivedAt) === today) {
      delivered++;
      if (s.arrivedAt <= trip.slaCommitAt) onTime++;
    }
  }

  perBtkm.sort((a, b) => a - b);
  return {
    deliveredWindow: delivered,
    onTimePct: delivered > 0 ? (onTime / delivered) * 100 : null,
    totalFreightInr: freight,
    detentionCostInr: detentionH * DETENTION_RATE_INR_PER_HOUR,
    medianCostPerBtkm: perBtkm.length ? perBtkm[Math.floor(perBtkm.length / 2)] : 0,
  };
}
