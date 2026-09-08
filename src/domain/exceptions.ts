import type { ExceptionCode, Severity } from "./types";

/* The exception taxonomy the control tower runs on. Phase 2 turns each of
   these into a pure rule of the form (trip, now) => Exception | null; phase 1
   defines them and seeds a plausible spread so the queue has something real
   to show. Thresholds are the ones an Indian FTL control tower actually uses. */

export interface ExceptionDef {
  code: ExceptionCode;
  label: string;
  /** The condition, phrased the way it would appear in an SOP. */
  trigger: string;
  severity: Severity;
  /** Where the controller's next action usually is. */
  owner: "Transporter" | "Plant" | "Driver" | "Compliance";
}

export const EXCEPTION_DEFS: Record<ExceptionCode, ExceptionDef> = {
  "EX-01": {
    code: "EX-01",
    label: "ETA slip",
    trigger: "Projected arrival exceeds the SLA commit",
    severity: "high",
    owner: "Transporter",
  },
  "EX-02": {
    code: "EX-02",
    label: "Unplanned stoppage",
    trigger: "Speed at zero for more than 120 minutes outside a known halt",
    severity: "medium",
    owner: "Driver",
  },
  "EX-03": {
    code: "EX-03",
    label: "Signal loss",
    trigger: "No GPS or SIM ping for more than 180 minutes",
    severity: "medium",
    owner: "Transporter",
  },
  "EX-04": {
    code: "EX-04",
    label: "Route deviation",
    trigger: "More than 25 km off the planned corridor",
    severity: "high",
    owner: "Driver",
  },
  "EX-05": {
    code: "EX-05",
    label: "Detention at origin",
    trigger: "Gate-in to gate-out beyond the 8 hour free period",
    severity: "medium",
    owner: "Plant",
  },
  "EX-06": {
    code: "EX-06",
    label: "Detention at destination",
    trigger: "Arrival to unloading complete beyond the 6 hour free period",
    severity: "medium",
    owner: "Plant",
  },
  "EX-07": {
    code: "EX-07",
    label: "E-way bill expiry risk",
    trigger: "Under 6 hours of validity left with distance still to run",
    severity: "critical",
    owner: "Compliance",
  },
  "EX-08": {
    code: "EX-08",
    label: "Night halt overrun",
    trigger: "Rest window exceeded by more than 3 hours",
    severity: "low",
    owner: "Driver",
  },
  "EX-09": {
    code: "EX-09",
    label: "Temperature excursion",
    trigger: "Reefer outside the permitted band for more than 15 minutes",
    severity: "critical",
    owner: "Transporter",
  },
  "EX-10": {
    code: "EX-10",
    label: "Payload variance",
    trigger: "Weighbridge tonnage outside tolerance against the indent",
    severity: "low",
    owner: "Plant",
  },
};

export const EXCEPTION_CODES = Object.keys(EXCEPTION_DEFS) as ExceptionCode[];

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Free time before detention starts accruing, by end of the trip. */
export const FREE_TIME_HOURS = { origin: 8, destination: 6 } as const;

/** Thresholds the phase-2 rules will read, kept in one place. */
export const THRESHOLDS = {
  stoppageMinutes: 120,
  signalLossMinutes: 180,
  routeDeviationKm: 25,
  ewayExpiryWarningHours: 6,
  nightHaltOverrunHours: 3,
  reeferExcursionMinutes: 15,
  payloadTolerancePct: 3,
} as const;
