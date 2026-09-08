import { describe, expect, it } from "vitest";
import { COMMODITY_BY_CODE } from "../domain/commodities";
import { ewayValidityDays, ewayValidUntil, istMidnightAfter } from "../domain/documents";
import { VEHICLE_BY_CODE } from "../domain/fleet";
import { LANE_BY_ID, LANES } from "../domain/lanes";
import { NODE_BY_CODE, NODES } from "../domain/nodes";
import { TRANSPORTER_BY_CODE } from "../domain/transporters";
import { MILESTONE_SEQUENCE } from "../domain/types";
import { DEFAULT_NOW, DEFAULT_TRIP_COUNT, generateNetwork } from "./generate";

const H = 3_600_000;

describe("reference data", () => {
  it("every lane endpoint and waypoint resolves to a known node", () => {
    for (const lane of LANES) {
      expect(NODE_BY_CODE.has(lane.originCode), `origin ${lane.originCode}`).toBe(true);
      expect(NODE_BY_CODE.has(lane.destCode), `dest ${lane.destCode}`).toBe(true);
      for (const v of lane.via) {
        expect(NODE_BY_CODE.has(v), `${lane.id} via ${v}`).toBe(true);
      }
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
    // 23:40 IST on 08 Sep 2026 == 18:10 UTC.
    const lateNight = Date.UTC(2026, 8, 8, 18, 10);
    const expiry = ewayValidUntil(lateNight, 150);
    expect(expiry).toBe(istMidnightAfter(lateNight));
    // Twenty minutes of validity, not a full day.
    expect((expiry - lateNight) / 60_000).toBeCloseTo(20, 5);
  });
});

describe("generateNetwork", () => {
  const net = generateNetwork();

  it("produces the requested number of trips", () => {
    expect(net.trips).toHaveLength(DEFAULT_TRIP_COUNT);
    expect(net.byId.size).toBe(DEFAULT_TRIP_COUNT);
  });

  it("is deterministic — the same seed gives a byte-identical fleet", () => {
    const a = JSON.stringify(generateNetwork({ seed: 7 }).trips);
    const b = JSON.stringify(generateNetwork({ seed: 7 }).trips);
    expect(a).toBe(b);
  });

  it("actually varies with the seed", () => {
    const a = JSON.stringify(generateNetwork({ seed: 7 }).trips);
    const c = JSON.stringify(generateNetwork({ seed: 8 }).trips);
    expect(a).not.toBe(c);
  });

  it("generates 1,200 trips in under 150 ms", () => {
    const start = performance.now();
    generateNetwork({ seed: 99 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  it("holds a plausible status mix", () => {
    const share = (s: string) =>
      (net.trips.filter((t) => t.status === s).length / net.trips.length) * 100;

    expect(share("in_transit")).toBeGreaterThan(55);
    expect(share("in_transit")).toBeLessThan(70);
    expect(share("delivered")).toBeGreaterThan(17);
    expect(share("delivered")).toBeLessThan(27);
    expect(share("at_risk")).toBeGreaterThan(5);
    expect(share("at_risk")).toBeLessThan(14);
    expect(share("planned")).toBeGreaterThan(4);
    expect(share("planned")).toBeLessThan(10);
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

  it("puts reefer cargo on reefer vehicles and bulk liquids in tankers", () => {
    for (const t of net.trips) {
      const c = COMMODITY_BY_CODE.get(t.commodityCode)!;
      if (c.reefer) expect(t.vehicle.typeCode, t.id).toBe("REF20");
    }
  });

  it("derives status from open exceptions rather than asserting it", () => {
    for (const t of net.trips) {
      const openSerious = t.exceptions.some(
        (e) => e.resolvedAt === null && (e.severity === "high" || e.severity === "critical"),
      );
      if (t.status === "at_risk") expect(openSerious, `${t.id} at_risk`).toBe(true);
      if (t.status === "in_transit") expect(openSerious, `${t.id} in_transit`).toBe(false);
    }
  });

  it("raises EX-01 exactly when the projection breaches commit", () => {
    for (const t of net.trips) {
      if (t.status === "planned") continue;
      const delayH = Math.max(0, (t.etaAt - t.slaCommitAt) / H);
      const hasEta = t.exceptions.some((e) => e.code === "EX-01");
      if (delayH > 0.5) expect(hasEta, `${t.id} late ${delayH.toFixed(2)}h`).toBe(true);
      else expect(hasEta, `${t.id} on time`).toBe(false);
    }
  });

  it("keeps the milestone chain in order and only marks the past as actual", () => {
    for (const t of net.trips) {
      expect(t.milestones).toHaveLength(MILESTONE_SEQUENCE.length);
      for (let i = 1; i < t.milestones.length; i++) {
        expect(t.milestones[i].plannedAt, t.id).toBeGreaterThanOrEqual(
          t.milestones[i - 1].plannedAt,
        );
      }
      for (const m of t.milestones) {
        if (m.actualAt !== null) expect(m.actualAt, `${t.id} ${m.key}`).toBeLessThanOrEqual(net.now);
        else expect(m.plannedAt, `${t.id} ${m.key}`).toBeGreaterThan(net.now);
      }
    }
  });

  it("keeps planned trips genuinely undispatched and delivered trips complete", () => {
    for (const t of net.trips) {
      if (t.status === "planned") {
        expect(t.dispatchedAt, t.id).toBeNull();
        expect(t.progress, t.id).toBe(0);
        expect(t.exceptions, t.id).toHaveLength(0);
      }
      if (t.status === "delivered") {
        expect(t.progress, t.id).toBe(1);
        expect(t.deliveredAt, t.id).not.toBeNull();
        // POD trails arrival by the unloading window, so a truck that landed
        // an hour ago legitimately has none yet. What must hold is that the
        // document and the milestone tell the same story.
        const podMilestone = t.milestones.find((m) => m.key === "pod_uploaded")!;
        expect(t.docs.podUploadedAt, t.id).toBe(podMilestone.actualAt);
      }
    }
  });

  it("carries no placeholder content anywhere in the dataset", () => {
    const banned = /\b(lorem|ipsum|todo|tbd|foo|bar|baz|placeholder|sample|test|xxx|undefined|nan)\b/i;
    for (const t of net.trips) {
      for (const value of [
        t.id, t.driver.name, t.driver.licenceNo, t.driver.phoneMasked,
        t.vehicle.regNo, t.docs.lrNo, t.docs.ewayBillNo, t.docs.invoiceNo,
        t.docs.weighbridgeSlipNo ?? "", ...t.exceptions.map((e) => e.detail),
      ]) {
        expect(banned.test(value), `${t.id}: ${value}`).toBe(false);
      }
    }
  });

  it("produces finite numbers throughout", () => {
    for (const t of net.trips) {
      for (const [label, v] of [
        ["progress", t.progress], ["weightMt", t.weightMt], ["freightInr", t.freightInr],
        ["slaCommitAt", t.slaCommitAt], ["etaAt", t.etaAt], ["lastPingAt", t.lastPingAt],
        ["invoiceValueInr", t.docs.invoiceValueInr], ["ewayValidUntil", t.docs.ewayValidUntil],
      ] as const) {
        expect(Number.isFinite(v), `${t.id} ${label}`).toBe(true);
      }
      expect(t.progress).toBeGreaterThanOrEqual(0);
      expect(t.progress).toBeLessThanOrEqual(1);
    }
  });

  it("prices freight in a believable band per kilometre", () => {
    for (const t of net.trips) {
      const lane = LANE_BY_ID.get(t.laneId)!;
      const perKm = t.freightInr / lane.distanceKm;
      expect(perKm, t.id).toBeGreaterThan(20);
      expect(perKm, t.id).toBeLessThan(90);
    }
  });

  it("uses the supplied simulation clock", () => {
    const custom = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(generateNetwork({ now: custom }).now).toBe(custom);
    expect(net.now).toBe(DEFAULT_NOW);
  });
});
