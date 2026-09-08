import { describe, expect, it } from "vitest";
import { makeCtx, makeTrip, T0 } from "./fixtures";
import { RULE_BY_CODE, RULES } from "./rules";
import type { ExceptionCode, Incident } from "../domain/types";

const H = 3_600_000;

const run = (code: ExceptionCode, ctx: Parameters<typeof RULES[number]["evaluate"]>[0]) =>
  RULE_BY_CODE.get(code)!.evaluate(ctx);

function incident(over: Partial<Incident> = {}): Incident {
  return { at: T0 - 3 * H, hours: 6, kind: "congestion", where: "Belagavi", ...over };
}

describe("the taxonomy is complete", () => {
  it("has exactly one rule per code, EX-01 through EX-10", () => {
    expect(RULES).toHaveLength(10);
    const codes = RULES.map((r) => r.code).sort();
    expect(codes).toEqual([
      "EX-01", "EX-02", "EX-03", "EX-04", "EX-05",
      "EX-06", "EX-07", "EX-08", "EX-09", "EX-10",
    ]);
  });

  it("never fires against a trip that has not been dispatched", () => {
    const ctx = makeCtx(makeTrip({ detentionOriginH: 20, dispatchedAt: T0 + 5 * H }), {
      status: "planned",
      etaAt: T0 + 100 * H,
      lastPingAt: T0 - 40 * H,
    });
    for (const rule of RULES) {
      if (!rule.appliesTo.includes("planned")) continue;
      expect(rule.evaluate(ctx), rule.code).toBeNull();
    }
  });
});

describe("EX-01 ETA slip", () => {
  const trip = makeTrip();

  it("fires once the projection crosses commit", () => {
    const hit = run("EX-01", makeCtx(trip, { etaAt: trip.slaCommitAt + 4.33 * H }));
    expect(hit?.detail).toBe("Projected 4h 20m past commit");
    expect(hit?.severity).toBe("high");
  });

  it("escalates to critical past twelve hours", () => {
    const hit = run("EX-01", makeCtx(trip, { etaAt: trip.slaCommitAt + 14 * H }));
    expect(hit?.severity).toBe("critical");
  });

  it("tolerates half an hour of slack", () => {
    expect(run("EX-01", makeCtx(trip, { etaAt: trip.slaCommitAt + 0.4 * H }))).toBeNull();
    expect(run("EX-01", makeCtx(trip, { etaAt: trip.slaCommitAt - 3 * H }))).toBeNull();
  });
});

describe("EX-02 unplanned stoppage", () => {
  it("fires after two hours stationary", () => {
    const hit = run(
      "EX-02",
      makeCtx(makeTrip(), { activeIncident: incident({ at: T0 - 3.5 * H }) }),
    );
    expect(hit?.detail).toBe("Halted 3h 30m near Belagavi");
  });

  it("stays quiet below the threshold and when nothing is wrong", () => {
    expect(
      run("EX-02", makeCtx(makeTrip(), { activeIncident: incident({ at: T0 - 1.5 * H }) })),
    ).toBeNull();
    expect(run("EX-02", makeCtx(makeTrip()))).toBeNull();
  });
});

describe("EX-03 signal loss", () => {
  it("fires after three hours of silence and names the provider", () => {
    const trip = makeTrip({
      vehicle: { regNo: "GJ-16-CT-7745", typeCode: "TNK20", gpsProvider: "SIM-based" },
    });
    const hit = run("EX-03", makeCtx(trip, { lastPingAt: T0 - 4.5 * H }));
    expect(hit?.detail).toBe("No ping for 4h 30m · SIM-based");
  });

  it("stays quiet while telemetry is arriving", () => {
    expect(run("EX-03", makeCtx(makeTrip(), { lastPingAt: T0 - 40 * 60_000 }))).toBeNull();
  });
});

describe("EX-04 route deviation", () => {
  it("fires on a diversion far enough off corridor", () => {
    const hit = run(
      "EX-04",
      makeCtx(makeTrip(), { activeIncident: incident({ kind: "diversion", hours: 4 }) }),
    );
    expect(hit?.detail).toBe("68 km off corridor near Belagavi");
  });

  it("ignores stoppages that are not diversions", () => {
    expect(
      run("EX-04", makeCtx(makeTrip(), { activeIncident: incident({ kind: "breakdown" }) })),
    ).toBeNull();
  });

  it("ignores a diversion inside the 25 km tolerance", () => {
    expect(
      run("EX-04", makeCtx(makeTrip(), { activeIncident: incident({ kind: "diversion", hours: 0.2 }) })),
    ).toBeNull();
  });
});

describe("EX-05 detention at origin", () => {
  it("fires past the eight hour free period", () => {
    const hit = run("EX-05", makeCtx(makeTrip({ detentionOriginH: 11.5 })));
    expect(hit?.detail).toBe("Gate-in to gate-out 11h 30m against 8h free");
  });

  it("stays quiet inside free time", () => {
    expect(run("EX-05", makeCtx(makeTrip({ detentionOriginH: 6 })))).toBeNull();
  });
});

describe("EX-06 detention at destination", () => {
  it("fires once unloading runs past the six hour free period", () => {
    const trip = makeTrip({ detentionDestH: 9 });
    const hit = run(
      "EX-06",
      makeCtx(trip, { status: "delivered", arrivedAt: T0 - 8 * H }),
    );
    expect(hit?.detail).toBe("Unloading 8h against 6h free");
  });

  it("counts only the time actually elapsed since arrival", () => {
    const trip = makeTrip({ detentionDestH: 9 });
    expect(run("EX-06", makeCtx(trip, { status: "delivered", arrivedAt: T0 - 2 * H }))).toBeNull();
  });
});

describe("EX-07 e-way bill expiry", () => {
  it("fires with under six hours of validity and road left to run", () => {
    const trip = makeTrip();
    trip.docs.ewayValidUntil = T0 + 1.83 * H;
    const hit = run("EX-07", makeCtx(trip, { remainingKm: 340 }));
    expect(hit?.detail).toBe("1h 50m validity left · 340 km to run");
  });

  it("reports an expiry that has already passed", () => {
    const trip = makeTrip();
    trip.docs.ewayValidUntil = T0 - 6.67 * H;
    const hit = run("EX-07", makeCtx(trip, { remainingKm: 42 }));
    expect(hit?.detail).toBe("Expired 6h 40m ago · 42 km to run");
  });

  it("does not care about validity once the truck has arrived", () => {
    const trip = makeTrip();
    trip.docs.ewayValidUntil = T0 - 5 * H;
    expect(run("EX-07", makeCtx(trip, { remainingKm: 0 }))).toBeNull();
  });
});

describe("EX-08 night halt overrun", () => {
  // 22:00 IST on 07 Sep 2026 is 16:30 UTC.
  const nightStart = Date.UTC(2026, 8, 7, 16, 30);

  it("fires when a night halt runs three hours past the rest window", () => {
    const now = nightStart + 12 * H;
    const hit = run(
      "EX-08",
      makeCtx(makeTrip(), { now, activeIncident: incident({ at: nightStart, hours: 14 }) }),
    );
    expect(hit?.detail).toBe("Rest window exceeded by 4h");
  });

  it("ignores a halt that began during the day", () => {
    const dayStart = Date.UTC(2026, 8, 8, 5, 0); // 10:30 IST
    expect(
      run("EX-08", makeCtx(makeTrip(), {
        now: dayStart + 12 * H,
        activeIncident: incident({ at: dayStart, hours: 14 }),
      })),
    ).toBeNull();
  });

  it("ignores a night halt still inside its window", () => {
    expect(
      run("EX-08", makeCtx(makeTrip(), {
        now: nightStart + 9 * H,
        activeIncident: incident({ at: nightStart, hours: 14 }),
      })),
    ).toBeNull();
  });
});

describe("EX-09 temperature excursion", () => {
  const trip = makeTrip({
    commodityCode: "FMC-FRZ",
    excursions: [{ at: T0 - 1.5 * H, hours: 3, deltaC: 3.6 }],
  });

  it("fires after fifteen minutes outside the band", () => {
    const hit = run("EX-09", makeCtx(trip, { reefer: true }));
    expect(hit?.detail).toBe("3.6 °C above band for 1h 30m");
    expect(RULE_BY_CODE.get("EX-09")!.code).toBe("EX-09");
  });

  it("stays quiet in the first few minutes of a wobble", () => {
    const fresh = makeTrip({
      excursions: [{ at: T0 - 8 * 60_000, hours: 3, deltaC: 2.1 }],
    });
    expect(run("EX-09", makeCtx(fresh, { reefer: true }))).toBeNull();
  });

  it("never fires on ambient cargo", () => {
    expect(run("EX-09", makeCtx(trip, { reefer: false }))).toBeNull();
  });
});

describe("EX-10 payload variance", () => {
  it("fires outside the three percent tolerance", () => {
    const trip = makeTrip({ weightMt: 15 });
    trip.docs.weighedMt = 14.2;
    const hit = run("EX-10", makeCtx(trip));
    expect(hit?.detail).toBe("Weighed 14.2 MT against 15.0 MT indented");
  });

  it("stays quiet inside tolerance", () => {
    const trip = makeTrip({ weightMt: 15 });
    trip.docs.weighedMt = 14.8;
    expect(run("EX-10", makeCtx(trip))).toBeNull();
  });

  it("stays quiet before the truck has been weighed", () => {
    const trip = makeTrip();
    trip.docs.weighedMt = null;
    expect(run("EX-10", makeCtx(trip))).toBeNull();
  });
});
