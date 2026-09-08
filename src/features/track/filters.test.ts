import { describe, expect, it } from "vitest";
import { LANE_BY_ID } from "../../domain/lanes";
import type { Trip, TripState } from "../../domain/types";
import { Engine } from "../../sim/engine";
import { generateNetwork } from "../../sim/generate";
import {
  EMPTY_FILTER,
  applyFilter,
  countActiveDimensions,
  describeFilter,
  isFilterActive,
  sortTrips,
  type TripFilter,
} from "./filters";

const net = generateNetwork();
const states = new Engine(net).step(net.epoch);
const trips = net.trips;

const filter = (patch: Partial<TripFilter>): TripFilter => ({ ...EMPTY_FILTER, ...patch });

function statusesIn(result: Trip[], s: ReadonlyMap<string, TripState>) {
  return new Set(result.map((t) => s.get(t.id)!.status));
}

describe("the empty filter", () => {
  it("is not active and selects the whole network", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(applyFilter(trips, states, EMPTY_FILTER)).toHaveLength(trips.length);
    expect(describeFilter(EMPTY_FILTER)).toHaveLength(0);
  });
});

describe("single dimensions", () => {
  it("narrows by status", () => {
    const result = applyFilter(trips, states, filter({ statuses: ["at_risk"] }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(trips.length);
    expect(statusesIn(result, states)).toEqual(new Set(["at_risk"]));
  });

  it("narrows by lane", () => {
    const laneId = trips[0].laneId;
    const result = applyFilter(trips, states, filter({ laneIds: [laneId] }));
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.laneId === laneId)).toBe(true);
  });

  it("narrows by transporter", () => {
    const code = trips[0].transporterCode;
    const result = applyFilter(trips, states, filter({ transporterCodes: [code] }));
    expect(result.every((t) => t.transporterCode === code)).toBe(true);
  });

  it("narrows by exception code", () => {
    const result = applyFilter(trips, states, filter({ codes: ["EX-07"] }));
    expect(result.length).toBeGreaterThan(0);
    for (const t of result) {
      const open = states.get(t.id)!.exceptions.filter((e) => e.resolvedAt === null);
      expect(open.some((e) => e.code === "EX-07"), t.id).toBe(true);
    }
  });

  it("narrows by severity", () => {
    const result = applyFilter(trips, states, filter({ severities: ["critical"] }));
    expect(result.length).toBeGreaterThan(0);
    for (const t of result) {
      const open = states.get(t.id)!.exceptions.filter((e) => e.resolvedAt === null);
      expect(open.some((e) => e.severity === "critical"), t.id).toBe(true);
    }
  });

  it("narrows to trips carrying anything at all", () => {
    const result = applyFilter(trips, states, filter({ withExceptions: true }));
    for (const t of result) {
      expect(
        states.get(t.id)!.exceptions.some((e) => e.resolvedAt === null),
        t.id,
      ).toBe(true);
    }
  });
});

describe("free text", () => {
  it("finds a trip by its LR number and by its registration", () => {
    const t = trips[42];
    expect(applyFilter(trips, states, filter({ query: t.docs.lrNo }))).toEqual([t]);
    const byReg = applyFilter(trips, states, filter({ query: t.vehicle.regNo }));
    expect(byReg.some((x) => x.id === t.id)).toBe(true);
  });

  it("treats multiple terms as AND, so a second word narrows", () => {
    const one = applyFilter(trips, states, filter({ query: "bhiwandi" }));
    const two = applyFilter(trips, states, filter({ query: "bhiwandi sharda" }));
    expect(one.length).toBeGreaterThan(0);
    expect(two.length).toBeGreaterThan(0);
    expect(two.length).toBeLessThan(one.length);
    expect(two.every((t) => one.includes(t))).toBe(true);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    const a = applyFilter(trips, states, filter({ query: "  DECCAN  " }));
    const b = applyFilter(trips, states, filter({ query: "deccan" }));
    expect(a.length).toBe(b.length);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("dimensions compose", () => {
  it("applies lane AND severity AND transporter together", () => {
    // Pick a combination known to have members by reading one off the board.
    const seed = trips.find((t) => {
      const s = states.get(t.id)!;
      return s.status === "at_risk";
    })!;
    const laneId = seed.laneId;

    const byLane = applyFilter(trips, states, filter({ laneIds: [laneId] }));
    const byLaneAndRisk = applyFilter(
      trips,
      states,
      filter({ laneIds: [laneId], statuses: ["at_risk"] }),
    );

    expect(byLaneAndRisk.length).toBeGreaterThan(0);
    expect(byLaneAndRisk.length).toBeLessThanOrEqual(byLane.length);
    expect(byLaneAndRisk.every((t) => t.laneId === laneId)).toBe(true);
    expect(statusesIn(byLaneAndRisk, states)).toEqual(new Set(["at_risk"]));

    // Adding a third dimension can only ever narrow further.
    const withTransporter = applyFilter(
      trips,
      states,
      filter({
        laneIds: [laneId],
        statuses: ["at_risk"],
        transporterCodes: [seed.transporterCode],
      }),
    );
    expect(withTransporter.length).toBeLessThanOrEqual(byLaneAndRisk.length);
    expect(withTransporter.some((t) => t.id === seed.id)).toBe(true);
  });

  it("requires one exception to satisfy both code and severity, not two", () => {
    // EX-03 is medium, so pairing it with critical must select nothing even
    // though plenty of trips carry both an EX-03 and a separate critical.
    const result = applyFilter(
      trips,
      states,
      filter({ codes: ["EX-03"], severities: ["critical"] }),
    );
    expect(result).toHaveLength(0);
  });

  it("counts active dimensions for the UI", () => {
    expect(countActiveDimensions(EMPTY_FILTER)).toBe(0);
    expect(
      countActiveDimensions(
        filter({ query: "x", statuses: ["at_risk"], laneIds: ["BHW-BLR"] }),
      ),
    ).toBe(3);
  });
});

describe("filter chips", () => {
  it("describe every active dimension and clear exactly one each", () => {
    const f = filter({
      query: "sharda",
      statuses: ["at_risk", "in_transit"],
      codes: ["EX-01"],
      laneIds: ["BHW-BLR"],
      withExceptions: true,
    });
    const chips = describeFilter(f);
    expect(chips).toHaveLength(6);

    // Clearing one chip leaves every other dimension intact.
    const cleared = chips.find((c) => c.key === "code:EX-01")!.clear(f);
    expect(cleared.codes).toHaveLength(0);
    expect(cleared.statuses).toHaveLength(2);
    expect(cleared.query).toBe("sharda");

    // Clearing all of them lands back at inactive.
    let acc = f;
    for (const chip of describeFilter(f)) acc = chip.clear(acc);
    expect(isFilterActive(acc)).toBe(false);
  });

  it("names the lane rather than showing a raw id", () => {
    const chips = describeFilter(filter({ laneIds: ["BHW-BLR"] }));
    expect(chips[0].label).toContain("Bhiwandi");
    expect(chips[0].label).toContain("Bengaluru");
    expect(LANE_BY_ID.has("BHW-BLR")).toBe(true);
  });
});

describe("sorting", () => {
  it("does not mutate the array it is given", () => {
    const input = trips.slice(0, 50);
    const before = input.map((t) => t.id);
    sortTrips(input, states, { key: "delay", direction: "desc" });
    expect(input.map((t) => t.id)).toEqual(before);
  });

  it("orders by delay in both directions", () => {
    const rows = trips.slice(0, 200);
    const desc = sortTrips(rows, states, { key: "delay", direction: "desc" });
    for (let i = 1; i < desc.length; i++) {
      expect(states.get(desc[i - 1].id)!.delayHours).toBeGreaterThanOrEqual(
        states.get(desc[i].id)!.delayHours,
      );
    }
    const asc = sortTrips(rows, states, { key: "delay", direction: "asc" });
    expect(states.get(asc[0].id)!.delayHours).toBeLessThanOrEqual(
      states.get(desc[0].id)!.delayHours,
    );
  });

  it("orders text columns alphabetically", () => {
    const sorted = sortTrips(trips.slice(0, 120), states, {
      key: "lr",
      direction: "asc",
    });
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].docs.lrNo.localeCompare(sorted[i].docs.lrNo)).toBeLessThanOrEqual(0);
    }
  });

  it("puts at-risk trips first when sorting by status", () => {
    const sorted = sortTrips(trips as Trip[], states, { key: "status", direction: "asc" });
    expect(states.get(sorted[0].id)!.status).toBe("at_risk");
  });

  it("returns the input untouched when nothing is sorted", () => {
    const rows = trips.slice(0, 10);
    expect(sortTrips(rows, states, null)).toBe(rows);
  });
});
