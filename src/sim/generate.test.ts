import { describe, expect, it } from "vitest";
import { COMMODITY_BY_CODE } from "../domain/commodities";
import { ewayValidityDays, ewayValidUntil, istMidnightAfter } from "../domain/documents";
import { VEHICLE_BY_CODE } from "../domain/fleet";
import { computeKpis } from "../domain/kpis";
import { LANE_BY_ID, LANES } from "../domain/lanes";
import { NODE_BY_CODE, NODES } from "../domain/nodes";
import { TRANSPORTER_BY_CODE } from "../domain/transporters";
import { MILESTONE_SEQUENCE, type TripStatus } from "../domain/types";
import { Engine } from "./engine";
import { DEFAULT_EPOCH, DEFAULT_TRIP_COUNT, generateNetwork } from "./generate";

const H = 3_600_000;

describe("reference data", () => {
  it("every lane endpoint and waypoint resolves to a known node", () => {
    for (const lane of LANES) {
      expect(NODE_BY_CODE.has(lane.originCode), `origin ${lane.originCode}`).toBe(true);
      expect(NODE_BY_CODE.has(lane.destCode), `dest ${lane.destCode}`).toBe(true);
      for (const v of lane.via) expect(NODE_BY_CODE.has(v), `${lane.id} via ${v}`).toBe(true);
    }
  });

  it("node codes and lane ids are unique", () => {
    expect(new Set(NODES.map((n) => n.code)).size).toBe(NODES.length);
    expect(new Set(LANES.map((l) => l.id)).size).toBe(LANES.length);
  });

  it("implied average speed stays in the range Indian FTL actually runs", () => {
    for (const lane of LANES) {
      const kmph = lane.distanceKm / lane.transitHours;
      expect(kmph, lane.id).toBeGreaterThan(15);
      expect(kmph, lane.id).toBeLessThan(30);
    }
  });

  it("coordinates fall inside India's bounding box", () => {
    for (const n of NODES) {
      expect(n.lat, n.code).toBeGreaterThan(6);
      expect(n.lat, n.code).toBeLessThan(37);
      expect(n.lng, n.code).toBeGreaterThan(68);
      expect(n.lng, n.code).toBeLessThan(98);
    }
  });
});

describe("e-way bill validity — CGST Rule 138", () => {
  it("gives one day up to 200 km and one more per 200 km or part", () => {
    expect(ewayValidityDays(1)).toBe(1);
    expect(ewayValidityDays(200)).toBe(1);
    expect(ewayValidityDays(201)).toBe(2);
    expect(ewayValidityDays(400)).toBe(2);
    expect(ewayValidityDays(985)).toBe(5);
    expect(ewayValidityDays(2180)).toBe(11);
  });

  it("uses the 20 km step for over-dimensional cargo", () => {
    expect(ewayValidityDays(20, true)).toBe(1);
    expect(ewayValidityDays(21, true)).toBe(2);
    expect(ewayValidityDays(200, true)).toBe(10);
  });

  it("expires at IST midnight, so a late-night bill gets a short first day", () => {
    const lateNight = Date.UTC(2026, 8, 8, 18, 10); // 23:40 IST
    const expiry = ewayValidUntil(lateNight, 150);
    expect(expiry).toBe(istMidnightAfter(lateNight));
    expect((expiry - lateNight) / 60_000).toBeCloseTo(20, 5);
  });
});

describe("generateNetwork", () => {
  const net = generateNetwork();

  it("produces the requested number of trips", () => {
    expect(net.trips).toHaveLength(DEFAULT_TRIP_COUNT);
    expect(net.byId.size).toBe(DEFAULT_TRIP_COUNT);
    expect(net.epoch).toBe(DEFAULT_EPOCH);
  });

  it("is deterministic — the same seed gives a byte-identical fleet", () => {
    expect(JSON.stringify(generateNetwork({ seed: 7 }).trips)).toBe(
      JSON.stringify(generateNetwork({ seed: 7 }).trips),
    );
  });

  it("actually varies with the seed", () => {
    expect(JSON.stringify(generateNetwork({ seed: 7 }).trips)).not.toBe(
      JSON.stringify(generateNetwork({ seed: 8 }).trips),
    );
  });

  it("generates 1,200 trips in under 150 ms", () => {
    const start = performance.now();
    generateNetwork({ seed: 99 });
    expect(performance.now() - start).toBeLessThan(150);
  });

  it("emits a plan, not a situation", () => {
    // Nothing in the generated trip says how it is doing right now — that is
    // the engine's job, and it is what lets the board change as time passes.
    const t = net.trips[0] as unknown as Record<string, unknown>;
    for (const derived of ["status", "progress", "etaAt", "deliveredAt", "exceptions"]) {
      expect(t[derived], derived).toBeUndefined();
    }
  });

  it("keeps every foreign key resolvable", () => {
    for (const t of net.trips) {
      expect(LANE_BY_ID.has(t.laneId), t.id).toBe(true);
      expect(TRANSPORTER_BY_CODE.has(t.transporterCode), t.id).toBe(true);
      expect(COMMODITY_BY_CODE.has(t.commodityCode), t.id).toBe(true);
      expect(VEHICLE_BY_CODE.has(t.vehicle.typeCode), t.id).toBe(true);
    }
  });

  it("never overloads a vehicle beyond its rated payload", () => {
    for (const t of net.trips) {
      const rated = VEHICLE_BY_CODE.get(t.vehicle.typeCode)!.payloadMt;
      expect(t.weightMt, `${t.id} ${t.vehicle.typeCode}`).toBeLessThanOrEqual(rated);
      expect(t.weightMt).toBeGreaterThan(0);
    }
  });

  it("puts temperature-controlled cargo on reefers, and only reefers carry excursions", () => {
    for (const t of net.trips) {
      const c = COMMODITY_BY_CODE.get(t.commodityCode)!;
      if (c.reefer) expect(t.vehicle.typeCode, t.id).toBe("REF20");
      else expect(t.excursions, t.id).toHaveLength(0);
    }
  });

  it("keeps incidents ordered, non-overlapping and inside the run", () => {
    for (const t of net.trips) {
      let previousEnd = t.dispatchedAt;
      for (const inc of t.incidents) {
        expect(inc.at, t.id).toBeGreaterThanOrEqual(previousEnd);
        expect(inc.hours, t.id).toBeGreaterThan(0);
        expect(inc.where.length, t.id).toBeGreaterThan(1);
        previousEnd = inc.at + inc.hours * H;
      }
    }
  });

  it("keeps the planned milestone chain in order", () => {
    for (const t of net.trips) {
      expect(t.milestones).toHaveLength(MILESTONE_SEQUENCE.length);
      for (let i = 1; i < t.milestones.length; i++) {
        expect(t.milestones[i].plannedAt, t.id).toBeGreaterThanOrEqual(
          t.milestones[i - 1].plannedAt,
        );
      }
    }
  });

  it("carries no placeholder content anywhere in the dataset", () => {
    const banned = /\b(lorem|ipsum|todo|tbd|foo|bar|baz|placeholder|sample|test|xxx|undefined|nan)\b/i;
    for (const t of net.trips) {
      for (const value of [
        t.id, t.driver.name, t.driver.licenceNo, t.driver.phoneMasked,
        t.vehicle.regNo, t.docs.lrNo, t.docs.ewayBillNo, t.docs.invoiceNo,
        t.docs.weighbridgeSlipNo ?? "", ...t.incidents.map((i) => i.where),
      ]) {
        expect(banned.test(value), `${t.id}: ${value}`).toBe(false);
      }
    }
  });

  it("produces finite numbers throughout", () => {
    for (const t of net.trips) {
      for (const [label, v] of [
        ["weightMt", t.weightMt], ["freightInr", t.freightInr],
        ["dispatchedAt", t.dispatchedAt], ["slaCommitAt", t.slaCommitAt],
        ["paceFactor", t.paceFactor], ["invoiceValueInr", t.docs.invoiceValueInr],
        ["ewayValidUntil", t.docs.ewayValidUntil],
      ] as const) {
        expect(Number.isFinite(v), `${t.id} ${label}`).toBe(true);
      }
      expect(t.paceFactor).toBeGreaterThan(0.5);
      expect(t.paceFactor).toBeLessThan(1.5);
    }
  });

  it("prices freight in a believable band per kilometre", () => {
    for (const t of net.trips) {
      const perKm = t.freightInr / LANE_BY_ID.get(t.laneId)!.distanceKm;
      expect(perKm, t.id).toBeGreaterThan(20);
      expect(perKm, t.id).toBeLessThan(90);
    }
  });
});

describe("the board at the epoch", () => {
  const net = generateNetwork();
  const states = new Engine(net).step(net.epoch);

  const share = (s: TripStatus) => {
    let n = 0;
    for (const st of states.values()) if (st.status === s) n++;
    return (n / net.trips.length) * 100;
  };

  it("opens on a plausible mix", () => {
    expect(share("in_transit")).toBeGreaterThan(52);
    expect(share("in_transit")).toBeLessThan(70);
    expect(share("delivered")).toBeGreaterThan(17);
    expect(share("delivered")).toBeLessThan(28);
    expect(share("at_risk")).toBeGreaterThan(4);
    expect(share("at_risk")).toBeLessThan(16);
    expect(share("planned")).toBeGreaterThan(4);
    expect(share("planned")).toBeLessThan(11);
  });

  it("reports KPIs in sane ranges", () => {
    const k = computeKpis(net.trips, states, net.epoch);
    expect(k.inTransit).toBeGreaterThan(500);
    expect(k.onTimePct).toBeGreaterThan(50);
    expect(k.onTimePct).toBeLessThanOrEqual(100);
    expect(k.visibilityPct).toBeGreaterThan(75);
    expect(k.visibilityPct).toBeLessThanOrEqual(100);
    expect(k.avgDelayH).toBeGreaterThan(0);
  });

  it("steps the whole fleet well inside a frame budget", () => {
    // Median of many steps, not one sample. A single wall-clock reading on a
    // shared machine catches a GC pause or a scheduling slip sooner or later
    // and fails a green build — which teaches everyone to ignore the suite.
    const engine = new Engine(net);
    engine.step(net.epoch); // warm

    const samples: number[] = [];
    for (let i = 1; i <= 15; i++) {
      const start = performance.now();
      engine.step(net.epoch + i * H);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];

    expect(median, `samples: ${samples.map((s) => s.toFixed(2)).join(", ")}`).toBeLessThan(8);
  });
});
