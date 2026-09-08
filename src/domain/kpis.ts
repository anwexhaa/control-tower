import { IST_OFFSET_MS } from "./documents";
import { SEVERITY_RANK } from "./exceptions";
import type { Trip, TripException, TripState } from "./types";

/* One definition per metric, computed in one place.

   The KPI strip, the trip drawer and Pulse all read from here, so the same
   figure cannot end up computed three different ways in three screens — the
   usual way a dashboard starts quietly lying. */

const H = 3_600_000;

/** Ping age past which a trip counts as dark. */
export const VISIBILITY_WINDOW_H = 3;

export interface Kpis {
  /** Everything on the road, at-risk trips included. */
  inTransit: number;
  /** Delivered within the SLA commit, as a share of all delivered. */
  onTimePct: number;
  /** On the road with an open high or critical exception against it. */
  atRisk: number;
  deliveredToday: number;
  /** Mean hours past commit, across late trips only. */
  avgDelayH: number;
  /** Share of active trips that have pinged inside the visibility window. */
  visibilityPct: number;
}

function istDayIndex(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / 86_400_000);
}

export function isActiveState(s: TripState): boolean {
  return s.status === "in_transit" || s.status === "at_risk";
}

export function isOpen(e: TripException): boolean {
  return e.resolvedAt === null;
}

export function computeKpis(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  now: number,
): Kpis {
  const today = istDayIndex(now);

  let inTransit = 0;
  let atRisk = 0;
  let deliveredToday = 0;
  let delivered = 0;
  let deliveredOnTime = 0;
  let lateCount = 0;
  let lateHours = 0;
  let active = 0;
  let visible = 0;

  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s) continue;

    if (isActiveState(s)) {
      inTransit++;
      active++;
      if (now - s.lastPingAt <= VISIBILITY_WINDOW_H * H) visible++;
      if (s.status === "at_risk") atRisk++;
      if (s.delayHours > 0) {
        lateCount++;
        lateHours += s.delayHours;
      }
    }

    if (s.status === "delivered" && s.arrivedAt !== null) {
      delivered++;
      if (s.arrivedAt <= trip.slaCommitAt) deliveredOnTime++;
      if (istDayIndex(s.arrivedAt) === today) deliveredToday++;
    }
  }

  return {
    inTransit,
    atRisk,
    deliveredToday,
    onTimePct: delivered ? (deliveredOnTime / delivered) * 100 : 0,
    avgDelayH: lateCount ? lateHours / lateCount : 0,
    visibilityPct: active ? (visible / active) * 100 : 0,
  };
}

export interface QueueItem {
  trip: Trip;
  exception: TripException;
}

/**
 * The triage queue: open exceptions across the network, worst first, then
 * oldest first inside a severity band. Acknowledged items sink below
 * unacknowledged ones of the same severity — somebody already has those.
 * Snoozed items drop out until their timer runs down.
 */
export function buildQueue(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  now: number,
): QueueItem[] {
  const items: QueueItem[] = [];
  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s) continue;
    for (const exception of s.exceptions) {
      if (!isOpen(exception)) continue;
      if (exception.snoozedUntil !== null && exception.snoozedUntil > now) continue;
      items.push({ trip, exception });
    }
  }

  items.sort((a, b) => {
    const bySeverity =
      SEVERITY_RANK[a.exception.severity] - SEVERITY_RANK[b.exception.severity];
    if (bySeverity !== 0) return bySeverity;

    const ackA = a.exception.acknowledgedAt === null ? 0 : 1;
    const ackB = b.exception.acknowledgedAt === null ? 0 : 1;
    if (ackA !== ackB) return ackA - ackB;

    return a.exception.raisedAt - b.exception.raisedAt;
  });

  return items;
}

/** Highest-severity open exception on a trip, for the row-level chip. */
export function worstOpen(exceptions: readonly TripException[]): TripException | null {
  let worst: TripException | null = null;
  for (const e of exceptions) {
    if (!isOpen(e)) continue;
    if (!worst || SEVERITY_RANK[e.severity] < SEVERITY_RANK[worst.severity]) worst = e;
  }
  return worst;
}

export function openCount(exceptions: readonly TripException[]): number {
  let n = 0;
  for (const e of exceptions) if (isOpen(e)) n++;
  return n;
}
