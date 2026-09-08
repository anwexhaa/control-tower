import { FREE_TIME_HOURS, THRESHOLDS } from "../domain/exceptions";
import { duration } from "../domain/format";
import { istHourOf } from "./profile";
import type {
  ExceptionCode,
  Incident,
  Severity,
  Trip,
  TripStatus,
} from "../domain/types";

/* ============================================================================
   The rules engine.

   Every rule is a pure function of (trip, derived state, instant). It returns
   a hit or null — it never raises, clears, acknowledges or stores anything.
   The engine owns that lifecycle, so a rule cannot accidentally depend on how
   often it is called, and a rule test is just a fixture and an assertion.

   All ten live in one file on purpose: the taxonomy is the interesting object,
   and reading it top to bottom is how you check the control tower covers what
   it should.
   ========================================================================== */

const H = 3_600_000;

/** What the engine hands a rule: the trip's plan plus where it actually is. */
export interface RuleContext {
  trip: Trip;
  now: number;
  status: TripStatus;
  progress: number;
  remainingKm: number;
  /** Projected arrival using only what the tower could know by `now`. */
  etaAt: number;
  arrivedAt: number | null;
  lastPingAt: number;
  activeIncident: Incident | null;
  /** True once the cargo is temperature-controlled. */
  reefer: boolean;
}

export interface RuleHit {
  detail: string;
  /** Overrides the taxonomy default when the situation warrants it. */
  severity?: Severity;
}

export interface Rule {
  code: ExceptionCode;
  /** Rules only run against trips in these states. */
  appliesTo: readonly TripStatus[];
  evaluate: (ctx: RuleContext) => RuleHit | null;
}

const RUNNING = ["in_transit", "at_risk"] as const;
const RUNNING_OR_DONE = ["in_transit", "at_risk", "delivered"] as const;

/* --------------------------------------------------------------- EX-01 --- */

/** The projection has crossed the contracted commit. */
const etaSlip: Rule = {
  code: "EX-01",
  appliesTo: RUNNING,
  evaluate: ({ trip, etaAt }) => {
    const late = (etaAt - trip.slaCommitAt) / H;
    if (late <= 0.5) return null;
    return {
      detail: `Projected ${duration(late)} past commit`,
      severity: late > 12 ? "critical" : "high",
    };
  },
};

/* --------------------------------------------------------------- EX-02 --- */

/** Stationary long enough that it is no longer traffic. */
const unplannedStoppage: Rule = {
  code: "EX-02",
  appliesTo: RUNNING,
  evaluate: ({ activeIncident, now }) => {
    if (!activeIncident) return null;
    const stoppedH = (now - activeIncident.at) / H;
    if (stoppedH * 60 < THRESHOLDS.stoppageMinutes) return null;
    return {
      detail: `Halted ${duration(stoppedH)} near ${activeIncident.where}`,
    };
  },
};

/* --------------------------------------------------------------- EX-03 --- */

/** Telemetry has gone dark on a truck that should be reporting. */
const signalLoss: Rule = {
  code: "EX-03",
  appliesTo: RUNNING,
  evaluate: ({ trip, now, lastPingAt }) => {
    const ageH = (now - lastPingAt) / H;
    if (ageH * 60 < THRESHOLDS.signalLossMinutes) return null;
    return {
      detail: `No ping for ${duration(ageH)} · ${trip.vehicle.gpsProvider}`,
    };
  },
};

/* --------------------------------------------------------------- EX-04 --- */

/** Off the contracted corridor far enough to matter. */
const routeDeviation: Rule = {
  code: "EX-04",
  appliesTo: RUNNING,
  evaluate: ({ activeIncident }) => {
    if (!activeIncident || activeIncident.kind !== "diversion") return null;
    // A diversion's length stands in for how far off corridor it ran.
    const km = Math.round(20 + activeIncident.hours * 12);
    if (km < THRESHOLDS.routeDeviationKm) return null;
    return { detail: `${km} km off corridor near ${activeIncident.where}` };
  },
};

/* --------------------------------------------------------------- EX-05 --- */

/** Free time at the loading plant was burnt through. Stays open as a claim. */
const detentionOrigin: Rule = {
  code: "EX-05",
  appliesTo: RUNNING_OR_DONE,
  evaluate: ({ trip }) => {
    if (trip.detentionOriginH <= FREE_TIME_HOURS.origin) return null;
    return {
      detail: `Gate-in to gate-out ${duration(trip.detentionOriginH)} against ${FREE_TIME_HOURS.origin}h free`,
    };
  },
};

/* --------------------------------------------------------------- EX-06 --- */

/** Sitting at the destination gate past the free period. */
const detentionDestination: Rule = {
  code: "EX-06",
  appliesTo: ["delivered"],
  evaluate: ({ trip, now, arrivedAt }) => {
    if (arrivedAt === null) return null;
    const sittingH = Math.min(trip.detentionDestH, (now - arrivedAt) / H);
    if (sittingH <= FREE_TIME_HOURS.destination) return null;
    return {
      detail: `Unloading ${duration(sittingH)} against ${FREE_TIME_HOURS.destination}h free`,
    };
  },
};

/* --------------------------------------------------------------- EX-07 --- */

/**
 * Validity running out with road left to cover. Critical because the penalty
 * is detention and a fine, and the clock is not one the tower controls.
 */
const ewayExpiry: Rule = {
  code: "EX-07",
  appliesTo: RUNNING,
  evaluate: ({ trip, now, remainingKm }) => {
    if (remainingKm <= 1) return null;
    const leftH = (trip.docs.ewayValidUntil - now) / H;
    if (leftH >= THRESHOLDS.ewayExpiryWarningHours) return null;
    return {
      detail:
        leftH <= 0
          ? `Expired ${duration(-leftH)} ago · ${Math.round(remainingKm)} km to run`
          : `${duration(leftH)} validity left · ${Math.round(remainingKm)} km to run`,
    };
  },
};

/* --------------------------------------------------------------- EX-08 --- */

/** A night halt that did not restart at dawn. */
const nightHaltOverrun: Rule = {
  code: "EX-08",
  appliesTo: RUNNING,
  evaluate: ({ activeIncident, now }) => {
    if (!activeIncident) return null;
    const startedHour = istHourOf(activeIncident.at);
    const inNightWindow = startedHour >= 20 || startedHour < 5;
    if (!inNightWindow) return null;

    const restWindowH = 8;
    const overrunH = (now - activeIncident.at) / H - restWindowH;
    if (overrunH < THRESHOLDS.nightHaltOverrunHours) return null;
    return { detail: `Rest window exceeded by ${duration(overrunH)}` };
  },
};

/* --------------------------------------------------------------- EX-09 --- */

/** Reefer outside its band. Critical: the cargo is the loss, not the trip. */
const temperatureExcursion: Rule = {
  code: "EX-09",
  appliesTo: RUNNING,
  evaluate: ({ trip, now, reefer }) => {
    if (!reefer) return null;
    for (const ex of trip.excursions) {
      if (ex.at > now) break;
      const end = ex.at + ex.hours * H;
      if (now >= end) continue;
      const forH = (now - ex.at) / H;
      if (forH * 60 < THRESHOLDS.reeferExcursionMinutes) return null;
      return {
        detail: `${ex.deltaC.toFixed(1)} °C above band for ${duration(forH)}`,
      };
    }
    return null;
  },
};

/* --------------------------------------------------------------- EX-10 --- */

/** Weighbridge disagrees with the indent beyond tolerance. */
const payloadVariance: Rule = {
  code: "EX-10",
  appliesTo: RUNNING_OR_DONE,
  evaluate: ({ trip }) => {
    const weighed = trip.docs.weighedMt;
    if (weighed === null) return null;
    const variancePct = Math.abs((weighed - trip.weightMt) / trip.weightMt) * 100;
    if (variancePct <= THRESHOLDS.payloadTolerancePct) return null;
    return {
      detail: `Weighed ${weighed.toFixed(1)} MT against ${trip.weightMt.toFixed(1)} MT indented`,
    };
  },
};

export const RULES: readonly Rule[] = [
  etaSlip,
  unplannedStoppage,
  signalLoss,
  routeDeviation,
  detentionOrigin,
  detentionDestination,
  ewayExpiry,
  nightHaltOverrun,
  temperatureExcursion,
  payloadVariance,
];

export const RULE_BY_CODE: ReadonlyMap<ExceptionCode, Rule> = new Map(
  RULES.map((r) => [r.code, r]),
);
