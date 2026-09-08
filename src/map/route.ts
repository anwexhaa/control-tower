import { LANE_BY_ID } from "../domain/lanes";
import { NODE_BY_CODE } from "../domain/nodes";
import {
  bearing,
  haversineKm,
  interpolate,
  project,
  type LatLng,
  type Point,
} from "./projection";

/* Lane geometry: the shape a corridor is drawn as, and where along it a truck
   sits at a given fraction of its journey.

   Routes are interpolated great-circle rather than straight — over 1,600 km a
   straight line in Mercator visibly cuts the corner, and a control tower map
   that puts a Ludhiana–Mumbai truck in the wrong state is worse than useless. */

export interface Route {
  points: LatLng[];
  /** Cumulative kilometres at each point; last entry is the total. */
  cum: number[];
  totalKm: number;
  /** The same polyline in world coordinates, for drawing. */
  world: Point[];
}

const cache = new Map<string, Route>();

/** Waypoints densified so each leg is drawn as a curve, not a chord. */
const STEPS_PER_LEG = 12;

export function routeFor(laneId: string): Route {
  const cached = cache.get(laneId);
  if (cached) return cached;

  const lane = LANE_BY_ID.get(laneId)!;
  const codes = [lane.originCode, ...lane.via, lane.destCode];
  const anchors = codes
    .map((c) => NODE_BY_CODE.get(c))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({ lat: n.lat, lng: n.lng }));

  const points: LatLng[] = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    for (let s = 1; s <= STEPS_PER_LEG; s++) {
      points.push(interpolate(anchors[i - 1], anchors[i], s / STEPS_PER_LEG));
    }
  }

  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]));
  }

  const route: Route = {
    points,
    cum,
    totalKm: cum[cum.length - 1],
    world: points.map((p) => project(p.lat, p.lng)),
  };
  cache.set(laneId, route);
  return route;
}

export interface Placement extends LatLng {
  /** Degrees, 0 = north. Points the truck glyph along the road. */
  heading: number;
}

/** Where a truck sits at fraction `f` of the corridor, and which way it faces. */
export function placeOnRoute(route: Route, f: number): Placement {
  const clamped = Math.max(0, Math.min(1, f));
  const target = clamped * route.totalKm;

  // Binary search the cumulative table — routes are ~90 points and this runs
  // once per trip per tick.
  let lo = 0;
  let hi = route.cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (route.cum[mid] <= target) lo = mid;
    else hi = mid;
  }

  const segment = route.cum[hi] - route.cum[lo];
  const t = segment > 0 ? (target - route.cum[lo]) / segment : 0;
  const here = interpolate(route.points[lo], route.points[hi], t);

  return {
    lat: here.lat,
    lng: here.lng,
    heading: bearing(route.points[lo], route.points[hi]),
  };
}

/** Node coordinates for the plants-and-warehouses layer. */
export function laneEndpoints(laneId: string): { origin: LatLng; dest: LatLng } {
  const lane = LANE_BY_ID.get(laneId)!;
  const o = NODE_BY_CODE.get(lane.originCode)!;
  const d = NODE_BY_CODE.get(lane.destCode)!;
  return {
    origin: { lat: o.lat, lng: o.lng },
    dest: { lat: d.lat, lng: d.lng },
  };
}
