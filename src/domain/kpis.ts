import { IST_OFFSET_MS } from "./documents";
import { SEVERITY_RANK } from "./exceptions";
import type { Trip, TripException } from "./types";

/* One definition per metric, computed in one place.

   The KPI strip, the trip drawer and Pulse all read from here, so the same
   figure cannot end up computed two different ways in three screens — which
   is the usual way a dashboard starts quietly lying. */

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

export function isActive(t: Trip): boolean {
  return t.status === "in_transit" || t.status === "at_risk";
}

export function delayHours(t: Trip): number {
  return Math.max(0, (t.etaAt - t.slaCommitAt) / H);
}

export function isOpen(e: TripException): boolean {
  return e.resolvedAt === null;
}

export function computeKpis(trips: readonly Trip[], now: number): Kpis {
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

  for (const t of trips) {
    if (isActive(t)) {
      inTransit++;
      active++;
      if (now - t.lastPingAt <= VISIBILITY_WINDOW_H * H) visible++;
      if (t.status === "at_risk") atRisk++;

      const d = delayHours(t);
      if (d > 0) {
        lateCount++;
        lateHours += d;
      }
    }

    if (t.status === "delivered" && t.deliveredAt !== null) {
      delivered++;
      if (t.deliveredAt <= t.slaCommitAt) deliveredOnTime++;
      if (istDayIndex(t.deliveredAt) === today) deliveredToday++;
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
 */
export function buildQueue(trips: readonly Trip[]): QueueItem[] {
  const items: QueueItem[] = [];
  for (const trip of trips) {
    for (const exception of trip.exceptions) {
      if (isOpen(exception)) items.push({ trip, exception });
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
export function worstOpen(t: Trip): TripException | null {
  let worst: TripException | null = null;
  for (const e of t.exceptions) {
    if (!isOpen(e)) continue;
    if (!worst || SEVERITY_RANK[e.severity] < SEVERITY_RANK[worst.severity]) worst = e;
  }
  return worst;
}
