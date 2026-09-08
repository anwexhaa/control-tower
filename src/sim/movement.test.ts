import { describe, expect, it } from "vitest";
import { makeTrip, T0 } from "./fixtures";
import { arrivalAt, averageKmph, lastPingAt, progressAt, speedKmphAt } from "./movement";
import { advanceBy, HOURLY_SPEED, integrate, istHourOf, speedFactorAt } from "./profile";

const H = 3_600_000;
const DAY = 86_400_000;

describe("speed profile", () => {
  it("normalises to a daily mean of one, so lane transit still means what it says", () => {
    const sum = HOURLY_SPEED.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(24, 9);
  });

  it("integrates a full day to exactly one day of effective driving", () => {
    expect(integrate(T0, T0 + DAY)).toBeCloseTo(24, 9);
    expect(integrate(T0, T0 + 3 * DAY)).toBeCloseTo(72, 9);
  });

  it("advanceBy inverts integrate", () => {
    for (const units of [0.5, 3, 11.25, 26, 71.5]) {
      const t = advanceBy(T0, units);
      expect(integrate(T0, t)).toBeCloseTo(units, 6);
    }
  });

  it("runs slower at night than mid-morning", () => {
    const night = Date.UTC(2026, 8, 7, 20, 0); // 01:30 IST
    const morning = Date.UTC(2026, 8, 8, 3, 0); // 08:30 IST
    expect(istHourOf(night)).toBe(1);
    expect(istHourOf(morning)).toBe(8);
    expect(speedFactorAt(night)).toBeLessThan(speedFactorAt(morning) * 0.5);
  });
});

describe("progress", () => {
  const trip = makeTrip({ dispatchedAt: T0, plannedTransitMs: 42 * H });

  it("is zero before dispatch and one after arrival", () => {
    expect(progressAt(trip, T0 - H)).toBe(0);
    expect(progressAt(trip, T0)).toBe(0);
    expect(progressAt(trip, arrivalAt(trip) + H)).toBe(1);
  });

  it("increases monotonically", () => {
    let previous = -1;
    for (let h = 0; h <= 42; h++) {
      const p = progressAt(trip, T0 + h * H);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });

  it("lands on the contracted transit when pace is exactly one", () => {
    expect(progressAt(trip, T0 + 42 * H)).toBeCloseTo(1, 6);
  });

  it("does not drift — the answer never depends on how the clock got there", () => {
    // The whole reason position is a closed-form integral rather than an
    // accumulator: stepping in ten-second slices must equal one big jump.
    const target = T0 + 27.5 * H;
    const direct = progressAt(trip, target);

    let stepped = 0;
    for (let t = T0; t <= target; t += 10_000) stepped = progressAt(trip, t);

    expect(stepped).toBeCloseTo(direct, 12);
  });
});

describe("incidents", () => {
  const stalled = makeTrip({
    dispatchedAt: T0,
    plannedTransitMs: 42 * H,
    incidents: [{ at: T0 + 10 * H, hours: 6, kind: "breakdown", where: "Belagavi" }],
  });

  it("freeze progress while they are in force", () => {
    const before = progressAt(stalled, T0 + 10 * H);
    const during = progressAt(stalled, T0 + 14 * H);
    expect(during).toBeCloseTo(before, 9);
  });

  it("push arrival out by roughly the time lost", () => {
    const clean = makeTrip({ dispatchedAt: T0, plannedTransitMs: 42 * H });
    const lost = (arrivalAt(stalled) - arrivalAt(clean)) / H;
    expect(lost).toBeGreaterThan(4);
    expect(lost).toBeLessThan(12);
  });

  it("are invisible to the projection until they actually start", () => {
    // This is what makes an ETA slip when a truck stops rather than in advance.
    const beforeIt = T0 + 5 * H;
    const duringIt = T0 + 12 * H;
    expect(arrivalAt(stalled, beforeIt)).toBeLessThan(arrivalAt(stalled, duringIt));
    expect(arrivalAt(stalled, duringIt)).toBeCloseTo(arrivalAt(stalled, Infinity), 0);
  });
});

describe("pace", () => {
  it("a slow truck arrives after its commit, a quick one before", () => {
    const slow = makeTrip({ dispatchedAt: T0, paceFactor: 0.9 });
    const quick = makeTrip({ dispatchedAt: T0, paceFactor: 1.1 });
    expect(arrivalAt(slow)).toBeGreaterThan(slow.slaCommitAt);
    expect(arrivalAt(quick)).toBeLessThan(quick.slaCommitAt);
  });
});

describe("instantaneous speed", () => {
  const trip = makeTrip({
    dispatchedAt: T0,
    incidents: [{ at: T0 + 4 * H, hours: 3, kind: "checkpost", where: "Pune" }],
  });

  it("averages out near the lane's implied speed", () => {
    // 985 km over 42 contracted hours.
    expect(averageKmph(trip, 985)).toBeGreaterThan(20);
    expect(averageKmph(trip, 985)).toBeLessThan(26);
  });

  it("is zero before dispatch, during a halt, and after arrival", () => {
    expect(speedKmphAt(trip, T0 - H, 985, null)).toBe(0);
    expect(speedKmphAt(trip, T0 + 5 * H, 985, null)).toBe(0);
    const arrived = arrivalAt(trip);
    expect(speedKmphAt(trip, arrived + H, 985, arrived)).toBe(0);
  });

  it("is positive while actually rolling", () => {
    expect(speedKmphAt(trip, T0 + H, 985, null)).toBeGreaterThan(0);
  });
});

describe("telemetry", () => {
  const trip = makeTrip({
    dispatchedAt: T0,
    gpsGaps: [{ at: T0 + 6 * H, hours: 5 }],
  });

  it("reports live while the unit is talking", () => {
    expect(lastPingAt(trip, T0 + 2 * H)).toBe(T0 + 2 * H);
  });

  it("freezes at the start of a dark window and resumes after it", () => {
    expect(lastPingAt(trip, T0 + 9 * H)).toBe(T0 + 6 * H);
    expect(lastPingAt(trip, T0 + 12 * H)).toBe(T0 + 12 * H);
  });
});
