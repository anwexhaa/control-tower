import { COMMODITIES, eligibleVehicleCodes } from "../domain/commodities";
import {
  ewayValidUntil,
  formatEwayBillNo,
  formatInvoiceNo,
  formatLrNo,
  formatWeighbridgeSlipNo,
} from "../domain/documents";
import { GPS_PROVIDERS, RTO_DISTRICTS, VEHICLE_BY_CODE } from "../domain/fleet";
import { LANES } from "../domain/lanes";
import { NODE_BY_CODE, nodeName } from "../domain/nodes";
import { DRIVER_FIRST_NAMES, DRIVER_LAST_NAMES, TRANSPORTERS } from "../domain/transporters";
import {
  MILESTONE_SEQUENCE,
  type Excursion,
  type GpsGap,
  type Incident,
  type IncidentKind,
  type Milestone,
  type MilestoneKey,
  type Network,
  type Trip,
} from "../domain/types";
import { makeRng, type Rng } from "./rng";

const H = 3_600_000;

export const DEFAULT_TRIP_COUNT = 1200;
export const DEFAULT_SEED = 42;
/** 08 Sep 2026, 06:40 IST — the shift the demo always opens on. */
export const DEFAULT_EPOCH = Date.UTC(2026, 8, 8, 1, 10, 0);

/* ============================================================================
   The generator produces a PLAN, not a situation.

   Nothing here says whether a trip is late, at risk or delivered. It lays down
   when the vehicle rolls, how well it runs, and what goes wrong along the way;
   the engine derives everything else from that plus the clock. Which means the
   board changes as time passes instead of being a still photograph.
   ========================================================================== */

type Lifecycle = "planned" | "active" | "delivered";

const LIFECYCLE_MIX: ReadonlyArray<readonly [Lifecycle, number]> = [
  ["active", 71],
  ["delivered", 22],
  ["planned", 7],
];

/**
 * Contracted transit carries buffer, so a healthy truck beats it slightly.
 * Genuine slowness — a tired combination of vehicle, driver and road — is the
 * exception, and it is what makes a trip drift late with no single incident to
 * point at.
 */
const SLOW_TRUCK_RATE = 0.05;

/** Share of trips that meet something that stops them entirely. */
const INCIDENT_RATE = 0.16;

const INCIDENT_KINDS: ReadonlyArray<readonly [IncidentKind, number]> = [
  ["congestion", 5],
  ["checkpost", 4],
  ["breakdown", 2],
  ["diversion", 1],
];

const VALUE_PER_MT: Record<string, number> = {
  FMCG: 82_000,
  Chemicals: 124_000,
  Tyres: 248_000,
  "Auto ancillary": 395_000,
  Alcobev: 152_000,
  "Building materials": 46_000,
};

const SERIES_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

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

function pointOnLane(rng: Rng, via: string[], originCode: string, destCode: string): string {
  return nodeName(rng.pick(via.length ? via : [originCode, destCode]));
}

/* ------------------------------------------------------------ generation --- */

export interface GenerateOptions {
  seed?: number;
  count?: number;
  /** The instant the board should look plausible at. */
  epoch?: number;
}

export function generateNetwork(options: GenerateOptions = {}): Network {
  const seed = options.seed ?? DEFAULT_SEED;
  const count = options.count ?? DEFAULT_TRIP_COUNT;
  const epoch = options.epoch ?? DEFAULT_EPOCH;

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
    const plannedTransitMs = lane.transitHours * H;

    // ---- cargo and vehicle -------------------------------------------------
    const commodity = rng.pick(COMMODITIES);
    const vehicleCode = rng.pick(eligibleVehicleCodes(commodity));
    const vehicleType = VEHICLE_BY_CODE.get(vehicleCode)!;

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

    // ---- how well it runs --------------------------------------------------
    const lifecycle = rng.weighted(LIFECYCLE_MIX);
    const paceFactor = rng.bool(SLOW_TRUCK_RATE)
      ? rng.float(0.84, 0.965)
      : rng.float(1.0, 1.12);

    // Nominal running time before anything goes wrong.
    const runMs = plannedTransitMs / paceFactor;

    // ---- what goes wrong ---------------------------------------------------
    // Placed as a fraction of the run so they can be positioned before the
    // dispatch time is known, then converted to absolute instants below.
    const incidentPlan = rng.bool(INCIDENT_RATE)
      ? [
          {
            fraction: rng.float(0.12, 0.88),
            hours: rng.float(2.2, 9),
            kind: rng.weighted(INCIDENT_KINDS),
            where: pointOnLane(rng, lane.via, lane.originCode, lane.destCode),
          },
        ]
      : [];
    const incidentHours = incidentPlan.reduce((a, b) => a + b.hours, 0);

    // ---- when it rolls -----------------------------------------------------
    // Chosen so that at the epoch the board shows the intended spread of
    // planned, running and closed-out trips.
    const totalRunMs = runMs + incidentHours * H;
    let dispatchedAt: number;
    if (lifecycle === "planned") {
      dispatchedAt = epoch + rng.float(1, 26) * H;
    } else if (lifecycle === "delivered") {
      dispatchedAt = epoch - totalRunMs - rng.float(0.5, 30) * H;
    } else {
      dispatchedAt = epoch - rng.float(0.03, 0.9) * totalRunMs;
    }

    const incidents: Incident[] = incidentPlan
      .map((p) => ({
        at: dispatchedAt + p.fraction * runMs,
        hours: p.hours,
        kind: p.kind,
        where: p.where,
      }))
      .sort((a, b) => a.at - b.at);

    // ---- telemetry gaps ----------------------------------------------------
    // SIM-based tracking drops out far more than a fitted unit.
    const dropoutRate = vehicle.gpsProvider === "SIM-based" ? 0.22 : 0.07;
    const gpsGaps: GpsGap[] = rng.bool(dropoutRate)
      ? [
          {
            at: dispatchedAt + rng.float(0.1, 0.9) * runMs,
            hours: rng.float(3.2, 9),
          },
        ]
      : [];

    // ---- reefer band -------------------------------------------------------
    const excursions: Excursion[] =
      commodity.reefer && rng.bool(0.12)
        ? [
            {
              at: dispatchedAt + rng.float(0.15, 0.85) * runMs,
              hours: rng.float(0.4, 2.4),
              deltaC: rng.float(1.6, 5.4),
            },
          ]
        : [];

    // ---- gate time ---------------------------------------------------------
    const detentionOriginH = Math.max(0, rng.gauss(4.2, 3.4));
    const detentionDestH = Math.max(0, rng.gauss(3.4, 2.8));

    // ---- documents ---------------------------------------------------------
    // Raised just before the vehicle rolls, because nobody dispatches on
    // validity they have already burnt. A slice get raised the previous shift
    // while the plant waits on a vehicle — those are the ones that go tight.
    const ewayGeneratedAt =
      dispatchedAt - (rng.bool(0.09) ? rng.float(8, 26) : rng.float(0.2, 4)) * H;

    const weighed = Math.round(weightMt * (1 + rng.gauss(0, 0.016)) * 10) / 10;

    const invoiceValueInr = Math.round(
      weightMt * (VALUE_PER_MT[commodity.industry] ?? 100_000) * rng.float(0.92, 1.08),
    );
    const freightInr = Math.round(
      lane.distanceKm * vehicleType.ratePerKm * rng.float(0.88, 1.12),
    );

    trips[i] = {
      id: `TRP-${88_000 + i}`,
      laneId: lane.id,
      transporterCode: transporter.code,
      commodityCode: commodity.code,
      vehicle,
      driver,
      weightMt,
      freightInr,
      indentedAt: dispatchedAt - rng.float(6, 20) * H,
      dispatchedAt,
      plannedTransitMs,
      slaCommitAt: dispatchedAt + plannedTransitMs,
      paceFactor,
      incidents,
      gpsGaps,
      excursions,
      detentionOriginH,
      detentionDestH,
      milestones: buildPlannedMilestones(rng, dispatchedAt, plannedTransitMs, detentionOriginH, detentionDestH),
      docs: {
        lrNo: formatLrNo(88_000 + i),
        ewayBillNo: formatEwayBillNo(Number(rng.digits(11))),
        ewayValidUntil: ewayValidUntil(ewayGeneratedAt, lane.distanceKm),
        invoiceNo: formatInvoiceNo(4000 + i),
        invoiceValueInr,
        weighbridgeSlipNo: formatWeighbridgeSlipNo(lane.originCode, 44_000 + i),
        weighedMt: weighed,
        podUploadedAt: null,
      },
    };
  }

  return { seed, epoch, trips, byId: new Map(trips.map((t) => [t.id, t])) };
}

/* ------------------------------------------------------------ milestones --- */

/**
 * The planned eleven-step chain, built backwards from dispatch because that is
 * what everything else is measured against. Actual timestamps are derived from
 * the clock by the engine, not stored here.
 */
function buildPlannedMilestones(
  rng: Rng,
  dispatchedAt: number,
  plannedTransitMs: number,
  detentionOriginH: number,
  detentionDestH: number,
): Milestone[] {
  const gateOut = dispatchedAt;
  const loadingComplete = gateOut - rng.float(0.3, 2) * H;
  const gateIn = loadingComplete - detentionOriginH * H;
  const vehiclePlaced = gateIn - rng.float(0.5, 3) * H;
  const transporterAccepted = vehiclePlaced - rng.float(2, 10) * H;
  const indentRaised = transporterAccepted - rng.float(0.5, 3) * H;

  const arrived = gateOut + plannedTransitMs;
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
    actualAt: null,
  }));
}
