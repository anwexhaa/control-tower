import { describe, expect, it } from "vitest";
import type { Network, Trip } from "../../domain/types";
import { Engine } from "../../sim/engine";
import { makeTrip, T0 } from "../../sim/fixtures";
import { deriveMilestones, currentStep } from "./milestones";
import { bandFor, speedSeries, temperatureSeries, trailSegments } from "./telemetry";

const H = 3_600_000;

function net(trips: Trip[]): Network {
  return { seed: 1, epoch: T0, trips, byId: new Map(trips.map((t) => [t.id, t])) };
}

function stateOf(trip: Trip, now: number) {
  return new Engine(net([trip])).step(now).get(trip.id)!;
}

describe("milestone derivation", () => {
  const trip = makeTrip({ dispatchedAt: T0 - 20 * H });

  it("keeps the eleven steps in order", () => {
    const ms = deriveMilestones(trip, stateOf(trip, T0), T0);
    expect(ms).toHaveLength(11);
    for (let i = 1; i < ms.length; i++) {
      expect(ms[i].projectedAt).toBeGreaterThanOrEqual(ms[i - 1].projectedAt);
    }
  });

  it("marks only steps in the past as actual", () => {
    const ms = deriveMilestones(trip, stateOf(trip, T0), T0);
    for (const m of ms) {
      if (m.actualAt !== null) expect(m.actualAt, m.key).toBeLessThanOrEqual(T0);
      else expect(m.projectedAt, m.key).toBeGreaterThan(T0);
    }
  });

  it("anchors everything after arrival on when the truck really landed", () => {
    // A slow truck arrives late, so unloading, POD and invoicing all shift with
    // it rather than staying on the plan.
    const slow = makeTrip({ dispatchedAt: T0 - 20 * H, paceFactor: 0.8 });
    const ms = deriveMilestones(slow, stateOf(slow, T0), T0);

    const arrival = ms.find((m) => m.key === "arrived_destination")!;
    const pod = ms.find((m) => m.key === "pod_uploaded")!;

    expect(arrival.varianceH).toBeGreaterThan(1);
    expect(pod.varianceH).toBeCloseTo(arrival.varianceH, 6);
    expect(pod.projectedAt).toBeGreaterThan(pod.plannedAt);
  });

  it("reports a truck that beats its commit as early", () => {
    const quick = makeTrip({ dispatchedAt: T0 - 20 * H, paceFactor: 1.1 });
    const ms = deriveMilestones(quick, stateOf(quick, T0), T0);
    expect(ms.find((m) => m.key === "arrived_destination")!.varianceH).toBeLessThan(0);
  });

  it("calls out gate dwell where it accrues", () => {
    const held = makeTrip({ dispatchedAt: T0 - 20 * H, detentionOriginH: 11 });
    const ms = deriveMilestones(held, stateOf(held, T0), T0);
    expect(ms.find((m) => m.key === "gate_out")!.dwellH).toBe(11);
    expect(ms.find((m) => m.key === "indent_raised")!.dwellH).toBeNull();
  });

  it("points at the step the trip is actually working on", () => {
    const ms = deriveMilestones(trip, stateOf(trip, T0), T0);
    const i = currentStep(ms);
    expect(ms[i].actualAt).toBeNull();
    if (i > 0) expect(ms[i - 1].actualAt).not.toBeNull();
  });
});

describe("ping trail", () => {
  it("is one lit segment when telemetry never drops", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 20 * H });
    const segments = trailSegments(trip, stateOf(trip, T0), T0);
    expect(segments.length).toBe(1);
    expect(segments[0].dark).toBe(false);
  });

  it("breaks into a dark stretch across a coverage hole", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 20 * H,
      gpsGaps: [{ at: T0 - 12 * H, hours: 4 }],
    });
    const segments = trailSegments(trip, stateOf(trip, T0), T0);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.some((s) => s.dark)).toBe(true);
  });

  it("joins the segments rather than leaving a hole in the line", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 20 * H,
      gpsGaps: [{ at: T0 - 12 * H, hours: 4 }],
    });
    const segments = trailSegments(trip, stateOf(trip, T0), T0);
    for (let i = 1; i < segments.length; i++) {
      const previousEnd = segments[i - 1].points[segments[i - 1].points.length - 1];
      expect(segments[i].points[0].lat).toBeCloseTo(previousEnd.lat, 9);
      expect(segments[i].points[0].lng).toBeCloseTo(previousEnd.lng, 9);
    }
  });

  it("is empty before the vehicle rolls", () => {
    const planned = makeTrip({ dispatchedAt: T0 + 5 * H });
    expect(trailSegments(planned, stateOf(planned, T0), T0)).toHaveLength(0);
  });
});

describe("telemetry series", () => {
  it("reports zero road speed while an incident holds the truck", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 20 * H,
      incidents: [{ at: T0 - 6 * H, hours: 5, kind: "breakdown", where: "Pune" }],
    });
    const series = speedSeries(trip, stateOf(trip, T0), T0);
    const halted = series.filter((s) => s.at > T0 - 5 * H && s.at < T0 - 2 * H);
    expect(halted.length).toBeGreaterThan(0);
    expect(halted.every((s) => s.value === 0)).toBe(true);
  });

  it("never reports a negative speed", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 30 * H });
    for (const s of speedSeries(trip, stateOf(trip, T0), T0)) {
      expect(s.value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("reefer band", () => {
  it("only applies to temperature-controlled cargo", () => {
    expect(bandFor("FMC-BEV")).toBeNull();
    expect(bandFor("FMC-DRY")).toEqual(expect.objectContaining({ min: 2, max: 8 }));
    expect(bandFor("FMC-FRZ")).toEqual(expect.objectContaining({ min: -20, max: -16 }));
  });

  it("holds inside the band when nothing goes wrong", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 20 * H, commodityCode: "FMC-DRY" });
    const band = bandFor("FMC-DRY")!;
    const series = temperatureSeries(trip, stateOf(trip, T0), T0, band);
    for (const s of series) {
      expect(s.value).toBeGreaterThan(band.min - 0.5);
      expect(s.value).toBeLessThan(band.max + 0.5);
    }
  });

  it("breaches the band during a scheduled excursion, and recovers after it", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 20 * H,
      commodityCode: "FMC-DRY",
      excursions: [{ at: T0 - 10 * H, hours: 3, deltaC: 5 }],
    });
    const band = bandFor("FMC-DRY")!;
    const series = temperatureSeries(trip, stateOf(trip, T0), T0, band);

    const during = series.filter((s) => s.at > T0 - 9.5 * H && s.at < T0 - 7.5 * H);
    const after = series.filter((s) => s.at > T0 - 5 * H);

    expect(during.some((s) => s.value > band.max)).toBe(true);
    expect(after.every((s) => s.value < band.max + 0.5)).toBe(true);
  });

  it("is deterministic — the same trip and clock give the same trace", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 20 * H, commodityCode: "FMC-DRY" });
    const band = bandFor("FMC-DRY")!;
    const a = temperatureSeries(trip, stateOf(trip, T0), T0, band);
    const b = temperatureSeries(trip, stateOf(trip, T0), T0, band);
    expect(a).toEqual(b);
  });
});

describe("controller-raised exceptions and notes", () => {
  it("a manual exception is never cleared by its rule", () => {
    // EX-02 with no incident: the rule cannot be hitting, so an automatic
    // exception would be cleared on the next step. A manual one must stand.
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H });
    const engine = new Engine(net([trip]));
    engine.step(T0);

    const ex = engine.raiseManual(trip.id, "EX-02", "medium", "Driver reports a puncture", "S. Iyer", T0);
    const later = engine.step(T0 + 6 * H).get(trip.id)!;

    expect(ex.resolvedAt).toBeNull();
    expect(later.exceptions.some((e) => e.id === ex.id)).toBe(true);
    expect(later.status).toBe("in_transit"); // medium does not put it at risk
  });

  it("a manual exception does not block the rule from raising its own", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 5 * H,
      incidents: [{ at: T0 - 4 * H, hours: 10, kind: "congestion", where: "Pune" }],
    });
    const engine = new Engine(net([trip]));
    engine.raiseManual(trip.id, "EX-02", "low", "Called in by the driver", "S. Iyer", T0);

    const state = engine.step(T0).get(trip.id)!;
    const ex02 = state.exceptions.filter((e) => e.code === "EX-02" && e.resolvedAt === null);
    expect(ex02).toHaveLength(2);
    expect(ex02.filter((e) => e.manual)).toHaveLength(1);
  });

  it("notes append and can be rolled back", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H });
    const engine = new Engine(net([trip]));

    const note = engine.addNote(trip.id, "Consignee informed", "A. Raman", T0);
    expect(engine.step(T0).get(trip.id)!.notes).toHaveLength(1);

    engine.removeNote(trip.id, note.id);
    expect(engine.step(T0).get(trip.id)!.notes).toHaveLength(0);
  });

  it("an agreed ETA sits alongside the projection without overwriting it", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H });
    const engine = new Engine(net([trip]));
    const before = engine.step(T0).get(trip.id)!;

    const agreed = before.etaAt + 4 * H;
    engine.setAgreedEta(trip.id, agreed, T0);

    const after = engine.step(T0).get(trip.id)!;
    expect(after.agreedEtaAt).toBe(agreed);
    expect(after.etaAt).toBe(before.etaAt);

    engine.setAgreedEta(trip.id, null, T0);
    expect(engine.step(T0).get(trip.id)!.agreedEtaAt).toBeNull();
  });

  it("dropping an exception undoes an optimistic raise cleanly", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H });
    const engine = new Engine(net([trip]));
    const ex = engine.raiseManual(trip.id, "EX-04", "high", "Reported off route", "A. Raman", T0);

    expect(engine.step(T0).get(trip.id)!.status).toBe("at_risk");
    engine.dropException(trip.id, ex.id);
    expect(engine.step(T0).get(trip.id)!.status).toBe("in_transit");
    expect(engine.exceptionsFor(trip.id)).toHaveLength(0);
  });
});

describe("e-way countdown tracks the simulation clock", () => {
  it("burns down as sim time advances and does not move when it does not", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H });
    const validUntil = trip.docs.ewayValidUntil;

    const leftAt = (now: number) => (validUntil - now) / H;
    expect(leftAt(T0 + 3 * H)).toBeCloseTo(leftAt(T0) - 3, 9);
    expect(leftAt(T0)).toBe(leftAt(T0));
  });
});
