import raw from "../data/india.simplified.json";
import { project, WORLD, type Bounds } from "./projection";

/* ============================================================================
   State boundaries, decoded once at module load.

   The committed file is delta-encoded integers at 0.001° (~110 m), simplified
   with Douglas–Peucker at 0.024° — about 0.6 of a screen pixel at the default
   fit, so the coarseness is invisible until you zoom well in. 6,296 points,
   46 KB raw and 19 KB over the wire, with no runtime network dependency.

   Source: geohacker/india state boundaries, simplified by scripts/simplify.mjs.
   ========================================================================== */

interface RawGeo {
  q: number;
  states: { n: string; r: number[][] }[];
}

const geo = raw as RawGeo;

export interface StateShape {
  name: string;
  /** SVG path in world coordinates — pan and zoom are a transform on top. */
  d: string;
}

function decode(): { shapes: StateShape[]; bounds: Bounds } {
  const shapes: StateShape[] = [];
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

  for (const state of geo.states) {
    const parts: string[] = [];

    for (const ring of state.r) {
      let qx = ring[0];
      let qy = ring[1];
      let out = "";

      for (let i = 0; i < ring.length; i += 2) {
        if (i > 0) {
          qx += ring[i];
          qy += ring[i + 1];
        }
        const lng = qx / geo.q;
        const lat = qy / geo.q;

        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;

        const p = project(lat, lng);
        out += `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      parts.push(`${out}Z`);
    }

    shapes.push({ name: state.n, d: parts.join("") });
  }

  return { shapes, bounds: { minLat, maxLat, minLng, maxLng } };
}

const decoded = decode();

export const INDIA_SHAPES: readonly StateShape[] = decoded.shapes;
export const INDIA_BOUNDS: Bounds = decoded.bounds;

/**
 * What the map opens on. Tighter than the full extent because the Andaman
 * chain sits 1,200 km off the east coast and no lane in the network touches
 * it — fitting to the true bounds would shrink the mainland for nothing.
 */
export const MAINLAND_BOUNDS: Bounds = {
  minLat: 7.5,
  maxLat: 35.6,
  minLng: 68.0,
  maxLng: 92.8,
};

/** Total points, for the readout in the map footer. */
export const BOUNDARY_POINTS = geo.states.reduce(
  (n, s) => n + s.r.reduce((m, r) => m + r.length / 2, 0),
  0,
);

export { WORLD };
