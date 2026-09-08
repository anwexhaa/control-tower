import { describe, expect, it } from "vitest";
import type { Network, Trip } from "../domain/types";
import { Engine } from "./engine";
import { makeTrip, T0 } from "./fixtures";
import { arrivalAt } from "./movement";

const H = 3_600_000;

function net(trips: Trip[]): Network {
  return { seed: 1, epoch: T0, trips, byId: new Map(trips.map((t) => [t.id, t])) };
}

describe("exception lifecycle", () => {
  it("raises once and then ages, rather than re-firing every tick", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H, detentionOriginH: 12 });
    const engine = new Engine(net([trip]));

    engine.step(T0);
    engine.step(T0 + H);
    engine.step(T0 + 2 * H);

    const all = engine.exceptionsFor(trip.id).filter((e) => e.code === "EX-05");
    expect(all).toHaveLength(1);
    expect(all[0].raisedAt).toBe(T0);
  });

  it("refreshes the detail line on the same record as the condition ages", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 5 * H,
      incidents: [{ at: T0 - 3 * H, hours: 20, kind: "breakdown", where: "Belagavi" }],
    });
    const engine = new Engine(net([trip]));

    engine.step(T0);
    const first = engine.exceptionsFor(trip.id).find((e) => e.code === "EX-02")!.detail;
    engine.step(T0 + 2 * H);
    const later = engine.exceptionsFor(trip.id).find((e) => e.code === "EX-02")!.detail;

    expect(first).toBe("Halted 3h near Belagavi");
    expect(later).toBe("Halted 5h near Belagavi");
    expect(engine.exceptionsFor(trip.id).filter((e) => e.code === "EX-02")).toHaveLength(1);
  });

  it("clears itself once the condition goes away", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 5 * H,
      incidents: [{ at: T0 - 3 * H, hours: 4, kind: "congestion", where: "Pune" }],
    });
    const engine = new Engine(net([trip]));

    engine.step(T0);
    const raised = engine.exceptionsFor(trip.id).find((e) => e.code === "EX-02")!;
    expect(raised.resolvedAt).toBeNull();

    // Incident ends at T0 + 1h; step past it and past the dwell floor.
    engine.step(T0 + 2 * H);
    expect(raised.resolvedAt).toBe(T0 + 2 * H);
    expect(raised.resolution).toBe("cleared");
  });

  it("holds an exception open through the dwell floor so it cannot flap", () => {
    const trip = makeTrip({
      dispatchedAt: T0 - 5 * H,
      incidents: [{ at: T0 - 2.05 * H, hours: 2.06, kind: "congestion", where: "Pune" }],
    });
    const engine = new Engine(net([trip]));

    engine.step(T0); // stopped 2h 03m — EX-02 raises
    const ex = engine.exceptionsFor(trip.id).find((e) => e.code === "EX-02")!;
    expect(ex).toBeDefined();

    // Condition is gone a minute later, but the record must stand.
    engine.step(T0 + 2 * 60_000);
    expect(ex.resolvedAt).toBeNull();

    engine.step(T0 + 15 * 60_000);
    expect(ex.resolvedAt).not.toBeNull();
  });
});

describe("status derivation", () => {
  it("marks a trip at risk only while something serious is open against it", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H, paceFactor: 0.8 });
    const engine = new Engine(net([trip]));
    const state = engine.step(T0).get(trip.id)!;

    expect(state.status).toBe("at_risk");
    expect(state.exceptions.some((e) => e.code === "EX-01")).toBe(true);
  });

  it("leaves a healthy running trip in transit", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H, paceFactor: 1.05 });
    const state = new Engine(net([trip])).step(T0).get(trip.id)!;
    expect(state.status).toBe("in_transit");
    expect(state.exceptions).toHaveLength(0);
  });

  it("reports planned before dispatch and delivered after arrival", () => {
    const trip = makeTrip({ dispatchedAt: T0 + 6 * H });
    const engine = new Engine(net([trip]));

    expect(engine.step(T0).get(trip.id)!.status).toBe("planned");
    expect(engine.step(arrivalAt(trip) + H).get(trip.id)!.status).toBe("delivered");
  });

  it("does not count a snoozed exception towards at risk", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H, paceFactor: 0.8 });
    const engine = new Engine(net([trip]));
    const ex = engine.step(T0).get(trip.id)!.exceptions[0];

    engine.snooze(trip.id, ex.id, T0 + 3 * H);
    expect(engine.step(T0).get(trip.id)!.status).toBe("in_transit");
    expect(engine.step(T0 + 4 * H).get(trip.id)!.status).toBe("at_risk");
  });
});

describe("controller actions", () => {
  const trip = makeTrip({ dispatchedAt: T0 - 5 * H, detentionOriginH: 12 });

  it("acknowledges without closing", () => {
    const engine = new Engine(net([trip]));
    const ex = engine.step(T0).get(trip.id)!.exceptions[0];
    engine.acknowledge(trip.id, ex.id, "S. Iyer", T0);

    expect(ex.acknowledgedAt).toBe(T0);
    expect(ex.acknowledgedBy).toBe("S. Iyer");
    expect(ex.resolvedAt).toBeNull();
  });

  it("records a manual resolution distinctly from one that cleared itself", () => {
    const engine = new Engine(net([trip]));
    const ex = engine.step(T0).get(trip.id)!.exceptions[0];
    engine.resolve(trip.id, ex.id, T0 + H);

    expect(ex.resolution).toBe("actioned");
    expect(ex.resolvedAt).toBe(T0 + H);
  });
});

describe("the clock can be driven any way at all", () => {
  it("reaches identical state whether stepped finely or in one jump", () => {
    const trips = [
      makeTrip({ id: "TRP-1", dispatchedAt: T0 - 20 * H, paceFactor: 0.95 }),
      makeTrip({
        id: "TRP-2",
        dispatchedAt: T0 - 6 * H,
        incidents: [{ at: T0 - 2 * H, hours: 5, kind: "breakdown", where: "Pune" }],
      }),
      makeTrip({ id: "TRP-3", dispatchedAt: T0 + 3 * H }),
    ];
    const target = T0 + 30 * H;

    const fine = new Engine(net(trips));
    for (let t = T0; t <= target; t += 5 * 60_000) fine.step(t);
    const fineStates = fine.step(target);

    const coarse = new Engine(net(trips));
    const coarseStates = coarse.step(target);

    for (const trip of trips) {
      const a = fineStates.get(trip.id)!;
      const b = coarseStates.get(trip.id)!;
      expect(a.progress, trip.id).toBeCloseTo(b.progress, 12);
      expect(a.etaAt, trip.id).toBeCloseTo(b.etaAt, 6);
      expect(a.status, trip.id).toBe(b.status);
      expect(a.arrivedAt, trip.id).toBe(b.arrivedAt);
    }
  });

  it("freezes completely when the clock does not move", () => {
    const trip = makeTrip({ dispatchedAt: T0 - 5 * H });
    const engine = new Engine(net([trip]));
    const a = engine.step(T0).get(trip.id)!;
    const b = engine.step(T0).get(trip.id)!;

    expect(b.progress).toBe(a.progress);
    expect(b.etaAt).toBe(a.etaAt);
    expect(b.lastPingAt).toBe(a.lastPingAt);
    expect(b.speedKmph).toBe(a.speedKmph);
  });
});

describe("a long run does not grow without bound", () => {
  /** Trips that flap: telemetry drops in and out repeatedly. */
  const flapping = () =>
    Array.from({ length: 40 }, (_, i) =>
      makeTrip({
        id: `TRP-${i}`,
        dispatchedAt: T0 - 5 * H,
        plannedTransitMs: 400 * H,
        gpsGaps: Array.from({ length: 30 }, (_, g) => ({
          at: T0 + (g * 8 + (i % 5)) * H,
          hours: 4,
        })),
      }),
    );

  it("caps the event log", () => {
    const engine = new Engine(net(flapping()));
    for (let t = T0; t <= T0 + 240 * H; t += 20 * 60_000) engine.step(t);
    expect(engine.getEvents().length).toBeLessThanOrEqual(2000);
  });

  it("caps closed exception history per trip while keeping open ones", () => {
    const trips = flapping();
    const engine = new Engine(net(trips));
    for (let t = T0; t <= T0 + 240 * H; t += 20 * 60_000) engine.step(t);

    for (const trip of trips) {
      const all = engine.exceptionsFor(trip.id);
      const closed = all.filter((e) => e.resolvedAt !== null);
      // Many more than this were raised and cleared over ten simulated days.
      expect(closed.length, trip.id).toBeLessThanOrEqual(12);
    }
  });

  it("still surfaces an open exception that predates the history cap", () => {
    const trip = makeTrip({
      id: "TRP-LONG",
      dispatchedAt: T0 - 5 * H,
      plannedTransitMs: 400 * H,
      detentionOriginH: 20, // EX-05 stays open the whole run
      gpsGaps: Array.from({ length: 30 }, (_, g) => ({ at: T0 + g * 8 * H, hours: 4 })),
    });
    const engine = new Engine(net([trip]));
    let states = engine.step(T0);
    for (let t = T0; t <= T0 + 240 * H; t += 20 * 60_000) states = engine.step(t);

    expect(states.get(trip.id)!.exceptions.some((e) => e.code === "EX-05")).toBe(true);
  });
});
