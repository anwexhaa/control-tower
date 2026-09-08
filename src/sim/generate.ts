import { COMMODITIES, eligibleVehicleCodes } from "../domain/commodities";
import {
  ewayValidUntil,
  formatEwayBillNo,
  formatInvoiceNo,
  formatLrNo,
  formatWeighbridgeSlipNo,
} from "../domain/documents";
import { EXCEPTION_DEFS, FREE_TIME_HOURS, THRESHOLDS } from "../domain/exceptions";
import { GPS_PROVIDERS, RTO_DISTRICTS, VEHICLE_BY_CODE } from "../domain/fleet";
import { duration } from "../domain/format";
import { LANES } from "../domain/lanes";
import { NODE_BY_CODE, nodeName } from "../domain/nodes";
import { DRIVER_FIRST_NAMES, DRIVER_LAST_NAMES, TRANSPORTERS } from "../domain/transporters";
import {
  MILESTONE_SEQUENCE,
  type ExceptionCode,
  type Milestone,
  type MilestoneKey,
  type Network,
  type Severity,
  type Trip,
  type TripException,
  type TripStatus,
} from "../domain/types";
import { makeRng, type Rng } from "./rng";

const H = 3_600_000;

/** Default fleet size — chosen to sit well above what a naive table can render. */
export const DEFAULT_TRIP_COUNT = 1200;
export const DEFAULT_SEED = 42;
/** 08 Sep 2026, 06:40 IST — the shift the demo always opens on. */
export const DEFAULT_NOW = Date.UTC(2026, 8, 8, 1, 10, 0);

/**
 * Where a trip sits in its life, which is a different question from whether it
 * is in trouble. Status is derived further down from the exceptions actually
 * raised — a trip is only "at risk" because something is open against it, never
 * because it was labelled that way.
 */
type Lifecycle = "planned" | "active" | "delivered";

const LIFECYCLE_MIX: ReadonlyArray<readonly [Lifecycle, number]> = [
  ["active", 71],
  ["delivered", 22],
  ["planned", 7],
];

/**
 * Share of active trips running late enough to breach commit. Tuned so the
 * derived at-risk bucket — this plus route deviations, e-way expiries and
 * reefer excursions — lands near 9% of the whole board.
 */
const LATE_RATE = 0.08;

/** Indicative cargo value per tonne, used to price the GST invoice. */
const VALUE_PER_MT: Record<string, number> = {
  FMCG: 82_000,
  Chemicals: 124_000,
  Tyres: 248_000,
  "Auto ancillary": 395_000,
  Alcobev: 152_000,
  "Building materials": 46_000,
};

const SERIES_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

const CONTROLLERS = [
  "A. Raman",
  "P. Deshpande",
  "S. Iyer",
  "N. Bhattacharya",
  "R. Chauhan",
] as const;

/* ------------------------------------------------------------- utilities --- */

function regNo(rng: Rng, stateCode: string): string {
  const districts = RTO_DISTRICTS[stateCode] ?? ["01"];
  return `${stateCode}-${rng.pick(districts)}-${rng.pick(SERIES_LETTERS)}${rng.pick(SERIES_LETTERS)}-${rng.digits(4)}`;
}

/** Only the last four digits are kept — enough to identify a crew on a call
    sheet, not enough to be anyone's real number. */
function driverPhoneMasked(rng: Rng): string {
  return `+91 9•••• •${rng.digits(4)}`;
}

function licenceNo(rng: Rng, stateCode: string): string {
  return `${stateCode}${rng.digits(2)} ${rng.digits(11)}`;
}

/** Somewhere plausible to name in an exception detail line. */
function pointOnLane(rng: Rng, via: string[], originCode: string, destCode: string): string {
  return nodeName(rng.pick(via.length ? via : [originCode, destCode]));
}

/* ------------------------------------------------------------ generation --- */

export interface GenerateOptions {
  seed?: number;
  count?: number;
  /** Simulation "now" the snapshot is built against. */
  now?: number;
}

export function generateNetwork(options: GenerateOptions = {}): Network {
  const seed = options.seed ?? DEFAULT_SEED;
  const count = options.count ?? DEFAULT_TRIP_COUNT;
  const now = options.now ?? DEFAULT_NOW;

  const rng = makeRng(seed);
  const trips: Trip[] = new Array(count);

  // Short corridors turn over faster, so they carry more concurrent trips.
  const laneWeights = LANES.map(
    (lane) => [lane, lane.distanceKm < 400 ? 3 : lane.distanceKm < 900 ? 2 : 1.2] as const,
  );

  for (let i = 0; i < count; i++) {
    const lane = rng.weighted(laneWeights);
    const origin = NODE_BY_CODE.get(lane.originCode)!;
    const dest = NODE_BY_CODE.get(lane.destCode)!;

    // ---- cargo and vehicle -------------------------------------------------
    const commodity = rng.pick(COMMODITIES);
    const vehicleCode = rng.pick(eligibleVehicleCodes(commodity));
    const vehicleType = VEHICLE_BY_CODE.get(vehicleCode)!;

    // Bulky freight cubes out before it weighs out, so it runs under rating.
    const utilisation = commodity.bulky
      ? rng.float(0.68, 0.86)
      : vehicleType.bodyType === "tanker" || vehicleType.bodyType === "reefer"
        ? rng.float(0.85, 0.98)
        : rng.float(0.88, 1.0);
    const weightMt = Math.round(vehicleType.payloadMt * utilisation * 10) / 10;

    // ---- carrier and crew --------------------------------------------------
    const serving = TRANSPORTERS.filter(
      (t) => t.zones.includes(origin.zone) || t.zones.includes(dest.zone),
    );
    const transporter = rng.pick(serving.length ? serving : TRANSPORTERS);

    const vehicle = {
      regNo: regNo(rng, origin.stateCode),
      typeCode: vehicleCode,
      gpsProvider: rng.pick(GPS_PROVIDERS),
    };
    const driver = {
      name: `${rng.pick(DRIVER_FIRST_NAMES)} ${rng.pick(DRIVER_LAST_NAMES)}`,
      licenceNo: licenceNo(rng, origin.stateCode),
      phoneMasked: driverPhoneMasked(rng),
    };

    // ---- how it is running -------------------------------------------------
    const lifecycle = rng.weighted(LIFECYCLE_MIX);
    const slaTransitMs = lane.transitHours * H;

    // A late trip has to be late by enough to matter on any lane length, so the
    // floor is expressed in hours rather than as a flat percentage — 6% of a
    // three-hour run is not a delay anybody opens a ticket about.
    const lateFloor = 1 + Math.max(0.06, 1.5 / lane.transitHours);
    const delayFactor =
      lifecycle === "delivered"
        ? rng.bool(0.24)
          ? rng.float(lateFloor, lateFloor + 0.35)
          : rng.float(0.9, 1.0)
        : rng.bool(LATE_RATE)
          ? rng.float(lateFloor, lateFloor + 0.45)
          : rng.float(0.88, 1.0);

    const actualTransitMs = slaTransitMs * delayFactor;

    const detentionOriginH = lifecycle === "planned" ? 0 : Math.max(0, rng.gauss(4.2, 3.4));
    const detentionDestH =
      lifecycle === "delivered" ? Math.max(0, rng.gauss(3.4, 2.8)) : 0;

    let progress: number;
    let dispatchedAt: number;
    let deliveredAt: number | null = null;

    if (lifecycle === "planned") {
      progress = 0;
      dispatchedAt = now + rng.float(1, 26) * H; // vehicle still to be placed
    } else if (lifecycle === "delivered") {
      progress = 1;
      deliveredAt = now - rng.float(0.5, 30) * H;
      dispatchedAt = deliveredAt - actualTransitMs;
    } else {
      progress = rng.float(0.05, 0.97);
      dispatchedAt = now - progress * actualTransitMs;
    }

    const slaCommitAt = dispatchedAt + slaTransitMs;
    const etaAt = lifecycle === "delivered" ? deliveredAt! : dispatchedAt + actualTransitMs;
    const delayHours = Math.max(0, (etaAt - slaCommitAt) / H);
    const remainingKm = lane.distanceKm * (1 - progress);

    // ---- telemetry ---------------------------------------------------------
    // SIM-based tracking drops out far more than a fitted unit; that spread is
    // what makes EX-03 land on the transporters it should.
    const proneToDropout = vehicle.gpsProvider === "SIM-based";
    const stalePing = lifecycle === "active" && rng.bool(proneToDropout ? 0.14 : 0.04);
    const lastPingAt =
      lifecycle === "planned"
        ? now - rng.float(0.1, 3) * H
        : lifecycle === "delivered"
          ? deliveredAt!
          : now - (stalePing ? rng.float(3.2, 9) : rng.float(0.02, 2.4)) * H;

    // ---- documents ---------------------------------------------------------
    // The bill is raised just before the vehicle rolls, because nobody
    // dispatches on validity they have already burnt. A slice get raised the
    // previous shift while the plant waits on a vehicle, and those are the
    // ones that go tight later — which is what makes EX-07 a real condition
    // rather than something sprinkled on at random.
    const ewayGeneratedAt =
      dispatchedAt - (rng.bool(0.09) ? rng.float(8, 26) : rng.float(0.2, 4)) * H;
    const ewayValidUntilMs = ewayValidUntil(ewayGeneratedAt, lane.distanceKm);

    // Weighbridge against indent. A controlled plant holds well inside the 3%
    // tolerance most of the time; the tail is what EX-10 is looking for.
    const weighed =
      lifecycle === "planned"
        ? null
        : Math.round(weightMt * (1 + rng.gauss(0, 0.016)) * 10) / 10;
    const payloadVariancePct =
      weighed === null ? 0 : Math.abs((weighed - weightMt) / weightMt) * 100;

    const invoiceValueInr = Math.round(
      weightMt * (VALUE_PER_MT[commodity.industry] ?? 100_000) * rng.float(0.92, 1.08),
    );
    const freightInr = Math.round(
      lane.distanceKm * vehicleType.ratePerKm * rng.float(0.88, 1.12),
    );

    // ---- milestones and exceptions ----------------------------------------
    const milestones = buildMilestones(rng, {
      now,
      dispatchedAt,
      actualTransitMs,
      detentionOriginH,
      detentionDestH,
    });

    const exceptions = buildExceptions(rng, {
      now,
      lifecycle,
      tripIndex: i,
      delayHours,
      lastPingAt,
      gpsProvider: vehicle.gpsProvider,
      detentionOriginH,
      detentionDestH,
      ewayValidUntilMs,
      remainingKm,
      reefer: commodity.reefer,
      payloadVariancePct,
      weighed,
      weightMt,
      via: lane.via,
      originCode: lane.originCode,
      destCode: lane.destCode,
    });

    // Status is derived, never assigned: a trip is at risk because something
    // serious is open against it right now.
    const hasOpenSerious = exceptions.some(
      (e) =>
        e.resolvedAt === null && (e.severity === "high" || e.severity === "critical"),
    );
    const status: TripStatus =
      lifecycle === "planned"
        ? "planned"
        : lifecycle === "delivered"
          ? "delivered"
          : hasOpenSerious
            ? "at_risk"
            : "in_transit";

    trips[i] = {
      id: `TRP-${88_000 + i}`,
      laneId: lane.id,
      transporterCode: transporter.code,
      commodityCode: commodity.code,
      vehicle,
      driver,
      status,
      progress,
      weightMt,
      freightInr,
      indentedAt: milestones[0].plannedAt,
      dispatchedAt: lifecycle === "planned" ? null : dispatchedAt,
      slaCommitAt,
      etaAt,
      deliveredAt,
      lastPingAt,
      detentionOriginH,
      detentionDestH,
      milestones,
      exceptions,
      docs: {
        lrNo: formatLrNo(88_000 + i),
        ewayBillNo: formatEwayBillNo(Number(rng.digits(11))),
        ewayValidUntil: ewayValidUntilMs,
        ewayDistanceCoveredKm: Math.round(lane.distanceKm * progress),
        invoiceNo: formatInvoiceNo(4000 + i),
        invoiceValueInr,
        weighbridgeSlipNo:
          lifecycle === "planned"
            ? null
            : formatWeighbridgeSlipNo(lane.originCode, 44_000 + i),
        weighedMt: weighed,
        podUploadedAt:
          lifecycle === "delivered"
            ? (milestones.find((m) => m.key === "pod_uploaded")?.actualAt ?? null)
            : null,
      },
    };
  }

  return { seed, now, trips, byId: new Map(trips.map((t) => [t.id, t])) };
}

/* ------------------------------------------------------------ milestones --- */

interface MilestoneContext {
  now: number;
  dispatchedAt: number;
  actualTransitMs: number;
  detentionOriginH: number;
  detentionDestH: number;
}

/**
 * Builds the eleven-step chain backwards from dispatch, because dispatch is
 * what everything else is measured against. A step gets an `actualAt` only
 * once it has happened; the rest stay null and read as projections.
 */
function buildMilestones(rng: Rng, ctx: MilestoneContext): Milestone[] {
  const { now, dispatchedAt, actualTransitMs, detentionOriginH, detentionDestH } = ctx;

  const gateOut = dispatchedAt;
  const loadingComplete = gateOut - rng.float(0.3, 2) * H;
  const gateIn = loadingComplete - detentionOriginH * H;
  const vehiclePlaced = gateIn - rng.float(0.5, 3) * H;
  const transporterAccepted = vehiclePlaced - rng.float(2, 10) * H;
  const indentRaised = transporterAccepted - rng.float(0.5, 3) * H;

  const arrived = gateOut + actualTransitMs;
  const unloaded = arrived + detentionDestH * H;
  const pod = unloaded + rng.float(0.5, 6) * H;

  const planned: Record<MilestoneKey, number> = {
    indent_raised: indentRaised,
    transporter_accepted: transporterAccepted,
    vehicle_placed: vehiclePlaced,
    gate_in: gateIn,
    loading_complete: loadingComplete,
    gate_out: gateOut,
    in_transit: gateOut,
    arrived_destination: arrived,
    unloading_complete: unloaded,
    pod_uploaded: pod,
    invoiced: pod + rng.float(6, 48) * H,
  };

  return MILESTONE_SEQUENCE.map((key) => ({
    key,
    plannedAt: planned[key],
    actualAt: planned[key] <= now ? planned[key] : null,
  }));
}

/* ------------------------------------------------------------ exceptions --- */

interface ExceptionContext {
  now: number;
  lifecycle: Lifecycle;
  tripIndex: number;
  delayHours: number;
  lastPingAt: number;
  gpsProvider: string;
  detentionOriginH: number;
  detentionDestH: number;
  ewayValidUntilMs: number;
  remainingKm: number;
  reefer: boolean;
  payloadVariancePct: number;
  weighed: number | null;
  weightMt: number;
  via: string[];
  originCode: string;
  destCode: string;
}

/**
 * Derives exceptions from the trip's own numbers, so every detail line agrees
 * with the data behind it — a delay of 4h 20m reads 4h 20m, and the e-way
 * countdown matches the bill on the documents tab.
 *
 * Phase 2 replaces this with the rules engine evaluating on every tick. The
 * shape it produces is identical, which is what makes that swap cheap.
 */
function buildExceptions(rng: Rng, ctx: ExceptionContext): TripException[] {
  const out: TripException[] = [];
  if (ctx.lifecycle === "planned") return out;

  const { now } = ctx;
  const closed = ctx.lifecycle === "delivered";
  const running = ctx.lifecycle === "active";
  let n = 0;

  const raise = (code: ExceptionCode, detail: string, severity?: Severity) => {
    const raisedAt = now - rng.float(0.2, 14) * H;
    const acknowledged = !closed && rng.bool(0.42);
    out.push({
      id: `${ctx.tripIndex}-${code}-${n++}`,
      code,
      severity: severity ?? EXCEPTION_DEFS[code].severity,
      raisedAt,
      acknowledgedAt: acknowledged ? raisedAt + rng.float(0.1, 3) * H : null,
      acknowledgedBy: acknowledged ? rng.pick(CONTROLLERS) : null,
      snoozedUntil: null,
      // A delivered trip's exceptions are history: they closed when it landed.
      resolvedAt: closed ? now - rng.float(0.1, 6) * H : null,
      detail,
    });
  };

  // EX-01 ETA slip — the reason most trips reach the queue at all.
  if (ctx.delayHours > 0.5) {
    raise(
      "EX-01",
      `Projected ${duration(ctx.delayHours)} past commit`,
      ctx.delayHours > 12 ? "critical" : "high",
    );
  }

  // EX-03 signal loss.
  const pingAgeH = (now - ctx.lastPingAt) / H;
  if (running && pingAgeH * 60 > THRESHOLDS.signalLossMinutes) {
    raise("EX-03", `No ping for ${duration(pingAgeH)} · ${ctx.gpsProvider}`);
  }

  // EX-05 / EX-06 detention beyond contracted free time.
  if (ctx.detentionOriginH > FREE_TIME_HOURS.origin) {
    raise(
      "EX-05",
      `Gate-in to gate-out ${duration(ctx.detentionOriginH)} against ${FREE_TIME_HOURS.origin}h free`,
    );
  }
  if (ctx.detentionDestH > FREE_TIME_HOURS.destination) {
    raise(
      "EX-06",
      `Unloading ${duration(ctx.detentionDestH)} against ${FREE_TIME_HOURS.destination}h free`,
    );
  }

  // EX-07 e-way bill validity against distance still to run.
  const validityLeftH = (ctx.ewayValidUntilMs - now) / H;
  if (running && ctx.remainingKm > 1 && validityLeftH < THRESHOLDS.ewayExpiryWarningHours) {
    raise(
      "EX-07",
      validityLeftH <= 0
        ? `Expired ${duration(-validityLeftH)} ago · ${Math.round(ctx.remainingKm)} km to run`
        : `${duration(validityLeftH)} validity left · ${Math.round(ctx.remainingKm)} km to run`,
    );
  }

  // EX-10 payload variance against the indent.
  if (ctx.weighed !== null && ctx.payloadVariancePct > THRESHOLDS.payloadTolerancePct) {
    raise(
      "EX-10",
      `Weighed ${ctx.weighed.toFixed(1)} MT against ${ctx.weightMt.toFixed(1)} MT indented`,
    );
  }

  // Conditions a static snapshot cannot derive get sampled. Phase 2 derives
  // all of these from movement instead.
  if (running && rng.bool(0.06)) {
    raise(
      "EX-02",
      `Halted ${duration(rng.float(2.1, 7))} near ${pointOnLane(rng, ctx.via, ctx.originCode, ctx.destCode)}`,
    );
  }
  if (running && rng.bool(0.02)) {
    raise(
      "EX-04",
      `${rng.int(26, 74)} km off corridor near ${pointOnLane(rng, ctx.via, ctx.originCode, ctx.destCode)}`,
    );
  }
  if (running && rng.bool(0.05)) {
    raise("EX-08", `Rest window exceeded by ${duration(rng.float(3.1, 8))}`);
  }
  if (ctx.reefer && running && rng.bool(0.08)) {
    raise(
      "EX-09",
      `${rng.float(1.6, 5.4).toFixed(1)} °C above band for ${duration(rng.float(0.3, 2.2))}`,
    );
  }

  return out;
}
