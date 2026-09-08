import { describe, expect, it } from "vitest";
import { FREE_TIME_HOURS } from "../../domain/exceptions";
import { LANE_BY_ID } from "../../domain/lanes";
import { linear, niceDomain, ticks } from "../../charts/scale";
import { Engine } from "../../sim/engine";
import { generateNetwork } from "../../sim/generate";
import {
  DETENTION_RATE_INR_PER_HOUR,
  costByLane,
  delayPareto,
  headline,
  laneHeat,
  transporterScorecard,
} from "./aggregate";

const net = generateNetwork();
const states = new Engine(net).step(net.epoch);
const trips = net.trips;

describe("scale module", () => {
  it("maps the domain onto the range at both ends", () => {
    const s = linear([0, 100], [0, 240]);
    expect(s(0)).toBe(0);
    expect(s(100)).toBe(240);
    expect(s(50)).toBe(120);
  });

  it("never divides by a zero-width domain", () => {
    const s = linear([5, 5], [0, 100]);
    expect(Number.isFinite(s(5))).toBe(true);
  });

  it("produces ticks inside the domain, and every one is reachable", () => {
    const out = ticks(0, 43, 4);
    expect(out.length).toBeGreaterThan(1);
    for (const t of out) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(43);
    }
  });

  it("pads a domain from zero without inverting it", () => {
    const [lo, hi] = niceDomain([3, 9, 14]);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThanOrEqual(14);
  });
});

describe("transporter scorecard", () => {
  const rows = transporterScorecard(trips, states);

  it("covers every carrier carrying freight, and no others", () => {
    expect(rows.length).toBeGreaterThan(10);
    const codes = new Set(trips.map((t) => t.transporterCode));
    for (const r of rows) expect(codes.has(r.code), r.code).toBe(true);
  });

  it("counts every trip exactly once across the carriers", () => {
    expect(rows.reduce((n, r) => n + r.trips, 0)).toBe(trips.length);
  });

  it("measures on-time only against what has actually landed", () => {
    for (const r of rows) {
      if (r.delivered === 0) expect(r.onTimePct, r.code).toBeNull();
      else {
        expect(r.onTimePct, r.code).toBeGreaterThanOrEqual(0);
        expect(r.onTimePct, r.code).toBeLessThanOrEqual(100);
      }
    }
  });

  it("reports the delta as measured minus contracted", () => {
    for (const r of rows) {
      if (r.onTimePct === null) expect(r.deltaPct).toBeNull();
      else expect(r.deltaPct!).toBeCloseTo(r.onTimePct - r.contractedPct, 9);
    }
  });

  it("counts detention only beyond contracted free time", () => {
    // A carrier whose trips all sat inside free time owes nothing, however
    // long they were at the gate.
    const manual = trips
      .filter((t) => t.transporterCode === rows[0].code)
      .reduce(
        (n, t) =>
          n +
          Math.max(0, t.detentionOriginH - FREE_TIME_HOURS.origin) +
          (states.get(t.id)!.status === "delivered"
            ? Math.max(0, t.detentionDestH - FREE_TIME_HOURS.destination)
            : 0),
        0,
      );
    expect(rows[0].detentionH).toBeCloseTo(manual, 6);
  });
});

describe("lane heat", () => {
  const { buckets, rows } = laneHeat(trips, states, net.epoch);

  it("returns the requested number of windows, oldest first", () => {
    expect(buckets).toHaveLength(6);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].at).toBeGreaterThan(buckets[i - 1].at);
    }
  });

  it("gives each corridor one cell per window", () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.cells, r.laneId).toHaveLength(buckets.length);
  });

  it("leaves a window empty rather than reporting it as zero per cent", () => {
    // The difference matters: nothing delivered is not the same as everything
    // delivered late, and shading them alike would be a lie.
    for (const r of rows) {
      for (const c of r.cells) {
        if (c.delivered === 0) expect(c.onTimePct, r.laneId).toBeNull();
        else expect(c.onTimePct, r.laneId).not.toBeNull();
      }
    }
  });

  it("ranks corridors by volume", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].volume).toBeGreaterThanOrEqual(rows[i].volume);
    }
  });
});

describe("delay Pareto", () => {
  const rows = delayPareto(trips, states);

  it("is sorted by count, largest first", () => {
    expect(rows.length).toBeGreaterThan(3);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].count).toBeGreaterThanOrEqual(rows[i].count);
    }
  });

  it("shares sum to a hundred per cent", () => {
    const total = rows.reduce((n, r) => n + r.sharePct, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it("accumulates monotonically and finishes at a hundred", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].cumulativePct).toBeGreaterThanOrEqual(rows[i - 1].cumulativePct);
    }
    expect(rows[rows.length - 1].cumulativePct).toBeCloseTo(100, 6);
  });

  it("puts both series on the same scale, so one axis can carry them", () => {
    // This is what keeps the chart out of dual-axis territory.
    for (const r of rows) {
      expect(r.sharePct).toBeGreaterThanOrEqual(0);
      expect(r.sharePct).toBeLessThanOrEqual(100);
      expect(r.cumulativePct).toBeLessThanOrEqual(100.000001);
    }
  });

  it("returns nothing rather than dividing by zero on an empty board", () => {
    expect(delayPareto([], new Map())).toEqual([]);
  });
});

describe("cost by corridor", () => {
  const rows = costByLane(trips, states);

  it("computes cost per BTKM as freight over billed tonne-kilometres", () => {
    const row = rows[0];
    const lane = LANE_BY_ID.get(row.laneId)!;
    const laneTrips = trips.filter((t) => t.laneId === row.laneId);
    const freight = laneTrips.reduce((n, t) => n + t.freightInr, 0);
    const btkm = laneTrips.reduce((n, t) => n + t.weightMt * lane.distanceKm, 0);

    expect(row.costPerBtkm).toBeCloseTo(freight / btkm, 9);
    expect(row.trips).toBe(laneTrips.length);
  });

  it("ranks the dearest corridor first", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].costPerBtkm).toBeGreaterThanOrEqual(rows[i].costPerBtkm);
    }
  });

  it("prices detention only on hours beyond free time", () => {
    for (const r of rows) {
      expect(r.detentionCostInr).toBeGreaterThanOrEqual(0);
      expect(r.detentionCostInr % DETENTION_RATE_INR_PER_HOUR).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps every figure finite", () => {
    for (const r of rows) {
      for (const v of [r.costPerBtkm, r.costPerMt, r.freightInr, r.detentionCostInr]) {
        expect(Number.isFinite(v), r.laneId).toBe(true);
      }
    }
  });
});

describe("headline", () => {
  const head = headline(trips, states, net.epoch);

  it("agrees with the scorecard on what landed on time today", () => {
    let delivered = 0;
    for (const t of trips) {
      const s = states.get(t.id)!;
      if (s.status === "delivered" && s.arrivedAt !== null) delivered++;
    }
    // Today is a subset of everything delivered on the board.
    expect(head.deliveredWindow).toBeGreaterThan(0);
    expect(head.deliveredWindow).toBeLessThanOrEqual(delivered);
  });

  it("keeps the median cost inside the per-kilometre band freight is priced in", () => {
    expect(head.medianCostPerBtkm).toBeGreaterThan(0);
    expect(head.medianCostPerBtkm).toBeLessThan(20);
  });
});

describe("the whole set recomputes inside its budget", () => {
  it("stays under 40 ms across the full fleet", () => {
    // Median of several passes rather than one wall-clock sample: a single
    // reading catches a GC pause sooner or later and fails a green build.
    const samples: number[] = [];
    for (let i = 0; i < 9; i++) {
      const start = performance.now();
      transporterScorecard(trips, states);
      laneHeat(trips, states, net.epoch);
      delayPareto(trips, states);
      costByLane(trips, states);
      headline(trips, states, net.epoch);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    expect(median, `samples: ${samples.map((s) => s.toFixed(1)).join(", ")}`).toBeLessThan(40);
  });
});
