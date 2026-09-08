import type { Trip } from "../domain/types";
import type { RuleContext } from "./rules";

/* Fixtures for rule tests. Every rule is pure in (trip, context), so a test is
   a hand-built trip, a hand-built moment, and one assertion — no engine, no
   clock, no generator. */

const H = 3_600_000;

/** 08 Sep 2026, 06:40 IST. */
export const T0 = Date.UTC(2026, 8, 8, 1, 10, 0);

export function makeTrip(over: Partial<Trip> = {}): Trip {
  const dispatchedAt = over.dispatchedAt ?? T0 - 10 * H;
  const plannedTransitMs = over.plannedTransitMs ?? 42 * H;

  return {
    id: "TRP-90001",
    laneId: "BHW-BLR",
    transporterCode: "SHR",
    commodityCode: "FMC-BEV",
    vehicle: { regNo: "MH-04-KL-8821", typeCode: "MXL32", gpsProvider: "Fleetbeat" },
    driver: {
      name: "Ramesh Yadav",
      licenceNo: "MH04 12345678901",
      phoneMasked: "+91 9•••• •7412",
    },
    weightMt: 14.2,
    freightInr: 51_220,
    indentedAt: dispatchedAt - 12 * H,
    dispatchedAt,
    plannedTransitMs,
    slaCommitAt: dispatchedAt + plannedTransitMs,
    paceFactor: 1,
    incidents: [],
    gpsGaps: [],
    excursions: [],
    detentionOriginH: 2,
    detentionDestH: 1.5,
    milestones: [],
    docs: {
      lrNo: "LR/26/0088214",
      ewayBillNo: "1234 5678 9012",
      ewayValidUntil: dispatchedAt + 5 * 24 * H,
      invoiceNo: "SI/2627/04821",
      invoiceValueInr: 1_164_400,
      weighbridgeSlipNo: "WB/BHW/09/44821",
      weighedMt: 14.2,
      podUploadedAt: null,
    },
    ...over,
  };
}

export function makeCtx(trip: Trip, over: Partial<RuleContext> = {}): RuleContext {
  return {
    trip,
    now: T0,
    status: "in_transit",
    progress: 0.4,
    remainingKm: 590,
    etaAt: trip.slaCommitAt,
    arrivedAt: null,
    lastPingAt: T0,
    activeIncident: null,
    reefer: false,
    ...over,
  };
}
