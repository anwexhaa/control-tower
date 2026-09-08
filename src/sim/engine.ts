import { COMMODITY_BY_CODE } from "../domain/commodities";
import { EXCEPTION_DEFS, SEVERITY_RANK } from "../domain/exceptions";
import { LANE_BY_ID } from "../domain/lanes";
import type {
  ExceptionCode,
  Network,
  Trip,
  TripException,
  TripState,
  TripStatus,
} from "../domain/types";
import { activeIncidentAt, arrivalAt, lastPingAt, progressAt, speedKmphAt } from "./movement";
import { RULES, type RuleContext } from "./rules";

const H = 3_600_000;

/**
 * How long an exception must stand before it is allowed to auto-clear. Without
 * it a condition sitting on a threshold flaps open and shut every tick and the
 * queue becomes unreadable.
 */
const MIN_DWELL_MS = 10 * 60 * 1000;

/** Events are capped: the log is a tail, not an archive that grows forever. */
const EVENT_CAP = 2000;

/**
 * Closed exceptions kept per trip. A long run at 600× raises and clears the
 * same conditions many times over — without a cap the history is an
 * ever-growing leak. Open exceptions are never dropped.
 */
const HISTORY_CAP = 12;

export type SimEventKind = "raised" | "cleared" | "acknowledged" | "resolved" | "dispatched" | "arrived";

export interface SimEvent {
  seq: number;
  at: number;
  kind: SimEventKind;
  tripId: string;
  code?: ExceptionCode;
  detail?: string;
}

/**
 * Owns the mutable half of the world: which exceptions are open, who has
 * acknowledged what, and the event tail. Everything else is recomputed from
 * the clock on every step, which is why nothing here can drift.
 */
export class Engine {
  private readonly network: Network;
  private readonly byTrip = new Map<string, TripException[]>();
  private readonly events: SimEvent[] = [];
  private seq = 0;
  private exceptionSeq = 0;
  /** Trips that had not rolled yet last step, so dispatch can be logged once. */
  private dispatched = new Set<string>();
  private arrived = new Set<string>();

  constructor(network: Network) {
    this.network = network;
  }

  getEvents(): readonly SimEvent[] {
    return this.events;
  }

  private log(e: Omit<SimEvent, "seq">): void {
    this.events.push({ ...e, seq: this.seq++ });
    if (this.events.length > EVENT_CAP) this.events.splice(0, this.events.length - EVENT_CAP);
  }

  /** All exceptions ever raised against a trip, open and closed. */
  exceptionsFor(tripId: string): TripException[] {
    return this.byTrip.get(tripId) ?? [];
  }

  /* ----------------------------------------------------- controller actions */

  acknowledge(tripId: string, exceptionId: string, by: string, now: number): void {
    const ex = this.exceptionsFor(tripId).find((e) => e.id === exceptionId);
    if (!ex || ex.acknowledgedAt !== null || ex.resolvedAt !== null) return;
    ex.acknowledgedAt = now;
    ex.acknowledgedBy = by;
    this.log({ at: now, kind: "acknowledged", tripId, code: ex.code });
  }

  resolve(tripId: string, exceptionId: string, now: number): void {
    const ex = this.exceptionsFor(tripId).find((e) => e.id === exceptionId);
    if (!ex || ex.resolvedAt !== null) return;
    ex.resolvedAt = now;
    ex.resolution = "actioned";
    this.log({ at: now, kind: "resolved", tripId, code: ex.code });
  }

  snooze(tripId: string, exceptionId: string, untilMs: number): void {
    const ex = this.exceptionsFor(tripId).find((e) => e.id === exceptionId);
    if (!ex || ex.resolvedAt !== null) return;
    ex.snoozedUntil = untilMs;
  }

  /* ------------------------------------------------------------------ step */

  /** Recompute the whole board at `now`. Pure in everything except exceptions. */
  step(now: number): Map<string, TripState> {
    const states = new Map<string, TripState>();

    for (const trip of this.network.trips) {
      const lane = LANE_BY_ID.get(trip.laneId)!;
      const commodity = COMMODITY_BY_CODE.get(trip.commodityCode)!;

      // ---- derived position and timing ------------------------------------
      const truthArrival = arrivalAt(trip, Infinity);
      const arrivedAt = now >= truthArrival ? truthArrival : null;
      const progress = progressAt(trip, now);
      const coveredKm = lane.distanceKm * progress;
      const remainingKm = lane.distanceKm - coveredKm;

      // The tower can only project from incidents that have already started.
      const etaAt = arrivedAt ?? arrivalAt(trip, now);
      const activeIncident = activeIncidentAt(trip, now);
      const speedKmph = speedKmphAt(trip, now, lane.distanceKm, arrivedAt);

      // ---- lifecycle -------------------------------------------------------
      // Provisional, because at-risk is a consequence of the rules below.
      const lifecycle: TripStatus =
        now < trip.dispatchedAt ? "planned" : arrivedAt !== null ? "delivered" : "in_transit";

      if (lifecycle !== "planned" && !this.dispatched.has(trip.id)) {
        this.dispatched.add(trip.id);
        this.log({ at: now, kind: "dispatched", tripId: trip.id });
      }
      if (lifecycle === "delivered" && !this.arrived.has(trip.id)) {
        this.arrived.add(trip.id);
        this.log({ at: now, kind: "arrived", tripId: trip.id });
      }

      const ctx: RuleContext = {
        trip,
        now,
        status: lifecycle,
        progress,
        remainingKm,
        etaAt,
        arrivedAt,
        lastPingAt: lastPingAt(trip, now),
        activeIncident,
        reefer: commodity.reefer,
      };

      const open = this.reconcile(trip, ctx, lifecycle, now);

      // ---- status is a consequence, never an assignment ---------------------
      const serious = open.some(
        (e) =>
          (e.severity === "high" || e.severity === "critical") &&
          (e.snoozedUntil === null || e.snoozedUntil <= now),
      );
      const status: TripStatus =
        lifecycle === "in_transit" && serious ? "at_risk" : lifecycle;

      states.set(trip.id, {
        status,
        progress,
        coveredKm,
        speedKmph,
        etaAt,
        delayHours: Math.max(0, (etaAt - trip.slaCommitAt) / H),
        arrivedAt,
        lastPingAt: ctx.lastPingAt,
        activeIncident,
        exceptions: this.exceptionsFor(trip.id),
      });
    }

    return states;
  }

  /**
   * Raise, refresh or clear each rule's exception for one trip.
   *
   * A rule that keeps hitting does not re-raise — the existing exception ages
   * and its detail line is refreshed, so "Halted 2h 10m" becomes "Halted 3h
   * 40m" on the same row rather than spawning a second one.
   */
  private reconcile(
    trip: Trip,
    ctx: RuleContext,
    lifecycle: TripStatus,
    now: number,
  ): TripException[] {
    let list = this.byTrip.get(trip.id);

    for (const rule of RULES) {
      const applicable = rule.appliesTo.includes(lifecycle);
      const hit = applicable ? rule.evaluate(ctx) : null;

      const existing = list?.find((e) => e.code === rule.code && e.resolvedAt === null);

      if (hit && !existing) {
        if (!list) {
          list = [];
          this.byTrip.set(trip.id, list);
        }
        const severity = hit.severity ?? EXCEPTION_DEFS[rule.code].severity;
        list.push({
          id: `${trip.id}-${rule.code}-${this.exceptionSeq++}`,
          code: rule.code,
          severity,
          raisedAt: now,
          acknowledgedAt: null,
          acknowledgedBy: null,
          snoozedUntil: null,
          resolvedAt: null,
          resolution: null,
          detail: hit.detail,
        });
        this.log({ at: now, kind: "raised", tripId: trip.id, code: rule.code, detail: hit.detail });
      } else if (hit && existing) {
        // Keep the ageing text and any escalation current on the same record.
        existing.detail = hit.detail;
        const next = hit.severity ?? EXCEPTION_DEFS[rule.code].severity;
        if (SEVERITY_RANK[next] < SEVERITY_RANK[existing.severity]) existing.severity = next;
      } else if (!hit && existing && now - existing.raisedAt >= MIN_DWELL_MS) {
        existing.resolvedAt = now;
        existing.resolution = "cleared";
        this.log({ at: now, kind: "cleared", tripId: trip.id, code: rule.code });
      }
    }

    if (!list) return EMPTY;

    // Trim closed history oldest-first, so a long run cannot grow without
    // bound. Anything still open survives regardless of age.
    let closed = 0;
    for (const e of list) if (e.resolvedAt !== null) closed++;
    if (closed > HISTORY_CAP) {
      let toDrop = closed - HISTORY_CAP;
      const kept: TripException[] = [];
      for (const e of list) {
        if (toDrop > 0 && e.resolvedAt !== null) {
          toDrop--;
          continue;
        }
        kept.push(e);
      }
      list.length = 0;
      list.push(...kept);
    }

    return list.filter((e) => e.resolvedAt === null);
  }
}

const EMPTY: TripException[] = [];
