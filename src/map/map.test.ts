import { describe, expect, it } from "vitest";
import { LANES } from "../domain/lanes";
import { NODES } from "../domain/nodes";
import { BOUNDARY_POINTS, INDIA_SHAPES, MAINLAND_BOUNDS } from "./geodata";
import { Quadtree } from "./quadtree";
import { placeOnRoute, routeFor } from "./route";
import {
  bearing,
  fitBounds,
  haversineKm,
  interpolate,
  project,
  toScreen,
  toWorld,
  unproject,
  WORLD,
  zoomAbout,
  type View,
} from "./projection";

describe("Web Mercator", () => {
  it("round-trips every freight node well inside a hundredth of a degree", () => {
    for (const n of NODES) {
      const p = project(n.lat, n.lng);
      const back = unproject(p.x, p.y);
      expect(Math.abs(back.lat - n.lat), `${n.code} lat`).toBeLessThan(0.01);
      expect(Math.abs(back.lng - n.lng), `${n.code} lng`).toBeLessThan(0.01);
    }
  });

  it("round-trips through a view transform too", () => {
    const view: View = { k: 3.7, tx: -412.5, ty: 88.25 };
    for (const n of NODES) {
      const s = toScreen(project(n.lat, n.lng), view);
      const w = toWorld(s.x, s.y, view);
      const back = unproject(w.x, w.y);
      expect(Math.abs(back.lat - n.lat), n.code).toBeLessThan(1e-6);
      expect(Math.abs(back.lng - n.lng), n.code).toBeLessThan(1e-6);
    }
  });

  it("places the origin at the centre of the world square", () => {
    const p = project(0, 0);
    expect(p.x).toBeCloseTo(WORLD / 2, 6);
    expect(p.y).toBeCloseTo(WORLD / 2, 6);
  });

  it("puts north above south and east right of west", () => {
    expect(project(28, 77).y).toBeLessThan(project(12, 77).y); // Delhi above Bengaluru
    expect(project(20, 72).x).toBeLessThan(project(20, 88).x); // Mumbai left of Kolkata
  });
});

describe("view fitting and zoom", () => {
  it("fits the mainland inside the viewport with room to spare", () => {
    const view = fitBounds(MAINLAND_BOUNDS, 900, 600, 18);
    const tl = toScreen(project(MAINLAND_BOUNDS.maxLat, MAINLAND_BOUNDS.minLng), view);
    const br = toScreen(project(MAINLAND_BOUNDS.minLat, MAINLAND_BOUNDS.maxLng), view);

    expect(tl.x).toBeGreaterThanOrEqual(17.5);
    expect(tl.y).toBeGreaterThanOrEqual(17.5);
    expect(br.x).toBeLessThanOrEqual(882.5);
    expect(br.y).toBeLessThanOrEqual(582.5);
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const view = fitBounds(MAINLAND_BOUNDS, 900, 600);
    const before = toWorld(400, 320, view);
    const zoomed = zoomAbout(view, 400, 320, 2.4, { min: 0.01, max: 1e6 });
    const after = toWorld(400, 320, zoomed);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("respects zoom limits", () => {
    const view: View = { k: 10, tx: 0, ty: 0 };
    expect(zoomAbout(view, 0, 0, 100, { min: 5, max: 20 }).k).toBe(20);
    expect(zoomAbout(view, 0, 0, 0.001, { min: 5, max: 20 }).k).toBe(5);
  });
});

describe("great-circle helpers", () => {
  it("measures a known corridor to within a few percent", () => {
    // Bhiwandi to Bengaluru: 985 km by road, roughly 845 straight line.
    const km = haversineKm({ lat: 19.2967, lng: 73.0631 }, { lat: 12.9716, lng: 77.5946 });
    expect(km).toBeGreaterThan(800);
    expect(km).toBeLessThan(890);
  });

  it("reports a southbound bearing as roughly south", () => {
    const b = bearing({ lat: 28.6, lng: 77.2 }, { lat: 12.97, lng: 77.59 });
    expect(b).toBeGreaterThan(170);
    expect(b).toBeLessThan(190);
  });

  it("interpolates the endpoints exactly and the midpoint sensibly", () => {
    const a = { lat: 19.2967, lng: 73.0631 };
    const b = { lat: 12.9716, lng: 77.5946 };
    expect(interpolate(a, b, 0).lat).toBeCloseTo(a.lat, 6);
    expect(interpolate(a, b, 1).lat).toBeCloseTo(b.lat, 6);

    const mid = interpolate(a, b, 0.5);
    expect(haversineKm(a, mid)).toBeCloseTo(haversineKm(mid, b), 3);
  });
});

describe("lane routes", () => {
  it("start at the origin node and end at the destination", () => {
    for (const lane of LANES.slice(0, 12)) {
      const route = routeFor(lane.id);
      const start = placeOnRoute(route, 0);
      const end = placeOnRoute(route, 1);
      expect(haversineKm(start, route.points[0]), lane.id).toBeLessThan(1);
      expect(haversineKm(end, route.points[route.points.length - 1]), lane.id).toBeLessThan(1);
    }
  });

  it("never run longer than the road distance they represent", () => {
    // The drawn polyline is great-circle through waypoints, so it must be
    // shorter than the road — if it is not, the waypoints are wrong.
    for (const lane of LANES) {
      const route = routeFor(lane.id);
      expect(route.totalKm, lane.id).toBeLessThanOrEqual(lane.distanceKm * 1.02);
      expect(route.totalKm, lane.id).toBeGreaterThan(lane.distanceKm * 0.45);
    }
  });

  it("advance monotonically along the corridor", () => {
    const route = routeFor("BHW-BLR");
    // Sampled finely: coarse sampling chords across every bend in the
    // corridor and undershoots, which says nothing about monotonicity.
    const STEPS = 2000;
    let travelled = 0;
    let previous = placeOnRoute(route, 0);

    for (let i = 1; i <= STEPS; i++) {
      const here = placeOnRoute(route, i / STEPS);
      const leg = haversineKm(previous, here);
      expect(leg, `step ${i} went backwards or jumped`).toBeLessThan(
        (route.totalKm / STEPS) * 3,
      );
      travelled += leg;
      previous = here;
    }

    expect(travelled).toBeGreaterThan(route.totalKm * 0.995);
    expect(travelled).toBeLessThanOrEqual(route.totalKm * 1.001);
  });

  it("clamp out-of-range fractions rather than flying off the map", () => {
    const route = routeFor("BHW-BLR");
    expect(placeOnRoute(route, -3).lat).toBeCloseTo(route.points[0].lat, 6);
    expect(placeOnRoute(route, 9).lat).toBeCloseTo(
      route.points[route.points.length - 1].lat,
      6,
    );
  });
});

describe("quadtree", () => {
  function seeded(n: number) {
    let a = 12345;
    const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: n }, (_, i) => ({
      x: rnd() * 1000,
      y: rnd() * 1000,
      value: i,
    }));
  }

  it("agrees with a brute-force scan", () => {
    const points = seeded(1200);
    const tree = new Quadtree<number>(0, 0, 1000, 1000);
    for (const p of points) tree.insert(p);
    expect(tree.size).toBe(1200);

    for (let trial = 0; trial < 200; trial++) {
      const qx = (trial * 37) % 1000;
      const qy = (trial * 71) % 1000;
      const radius = 25;

      let best: number | null = null;
      let bestSq = radius * radius;
      for (const p of points) {
        const d = (p.x - qx) ** 2 + (p.y - qy) ** 2;
        if (d <= bestSq) { bestSq = d; best = p.value; }
      }

      const found = tree.nearest(qx, qy, radius);
      expect(found?.value ?? null, `trial ${trial}`).toBe(best);
    }
  });

  it("returns nothing outside the radius", () => {
    const tree = new Quadtree<number>(0, 0, 1000, 1000);
    tree.insert({ x: 500, y: 500, value: 1 });
    expect(tree.nearest(500, 500, 5)?.value).toBe(1);
    expect(tree.nearest(700, 700, 5)).toBeNull();
  });

  it("resolves a hover in well under a millisecond at fleet scale", () => {
    const points = seeded(1200);
    const tree = new Quadtree<number>(0, 0, 1000, 1000);
    for (const p of points) tree.insert(p);

    const start = performance.now();
    for (let i = 0; i < 1000; i++) tree.nearest((i * 13) % 1000, (i * 29) % 1000, 12);
    const perQuery = (performance.now() - start) / 1000;

    expect(perQuery).toBeLessThan(1);
  });
});

describe("boundary data", () => {
  it("decodes into drawable state shapes", () => {
    expect(INDIA_SHAPES.length).toBeGreaterThan(28);
    expect(BOUNDARY_POINTS).toBeGreaterThan(4000);
    for (const s of INDIA_SHAPES) {
      expect(s.d.startsWith("M"), s.name).toBe(true);
      expect(s.d.endsWith("Z"), s.name).toBe(true);
    }
  });

  it("includes the states the network actually runs through", () => {
    const names = INDIA_SHAPES.map((s) => s.name);
    for (const required of [
      "Maharashtra", "Gujarat", "Karnataka", "Tamil Nadu",
      "Delhi", "Haryana", "West Bengal", "Assam",
    ]) {
      expect(names, required).toContain(required);
    }
  });

  it("puts every freight node inside the mainland view", () => {
    for (const n of NODES) {
      expect(n.lat, n.code).toBeGreaterThanOrEqual(MAINLAND_BOUNDS.minLat);
      expect(n.lat, n.code).toBeLessThanOrEqual(MAINLAND_BOUNDS.maxLat);
      expect(n.lng, n.code).toBeGreaterThanOrEqual(MAINLAND_BOUNDS.minLng);
      expect(n.lng, n.code).toBeLessThanOrEqual(MAINLAND_BOUNDS.maxLng);
    }
  });
});
