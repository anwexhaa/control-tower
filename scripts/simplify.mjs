import { readFileSync, writeFileSync } from "node:fs";

/* Simplify India state boundaries down to something worth committing.
   Douglas–Peucker, ring-area filtering, then quantise to 0.001 degrees
   (~110 m) and delta-encode along each ring. */

const src = JSON.parse(readFileSync("india.geojson", "utf8"));

function perpDistanceSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) {
    const ex = p[0] - a[0], ey = p[1] - a[1];
    return ex * ex + ey * ey;
  }
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const cx = a[0] + Math.max(0, Math.min(1, t)) * dx;
  const cy = a[1] + Math.max(0, Math.min(1, t)) * dy;
  const ex = p[0] - cx, ey = p[1] - cy;
  return ex * ex + ey * ey;
}

/** Iterative Douglas–Peucker — recursion blows the stack on 10k-point rings. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const tolSq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpDistanceSq(points[i], points[first], points[last]);
      if (d > maxSq) { maxSq = d; index = i; }
    }
    if (maxSq > tolSq && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function ringArea(points) {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(a / 2);
}

const Q = 1000;

function build(tolerance, minArea) {
  const states = [];
  let points = 0;

  for (const f of src.features) {
    const name = f.properties.NAME_1;
    const geom = f.geometry;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;

    const rings = [];
    for (const poly of polys) {
      // Outer ring only — holes are invisible at this scale.
      const ring = poly[0];
      if (ringArea(ring) < minArea) continue;

      const simplified = simplify(ring, tolerance);
      if (simplified.length < 4) continue;

      // Quantise, then delta-encode.
      const flat = [];
      let px = 0, py = 0;
      for (let i = 0; i < simplified.length; i++) {
        const x = Math.round(simplified[i][0] * Q);
        const y = Math.round(simplified[i][1] * Q);
        if (i === 0) { flat.push(x, y); } else {
          const dx = x - px, dy = y - py;
          if (dx === 0 && dy === 0) continue;
          flat.push(dx, dy);
        }
        px = x; py = y;
      }
      if (flat.length < 8) continue;
      rings.push(flat);
      points += flat.length / 2;
    }

    if (rings.length) states.push({ n: name, r: rings });
  }

  return { data: { q: Q, states }, points };
}

// Search for the tolerance that lands closest under the byte target.
const TARGET = 48_000;
let chosen = null;
for (const tol of [0.002, 0.004, 0.006, 0.008, 0.01, 0.014, 0.018, 0.024, 0.03, 0.04, 0.055]) {
  const { data, points } = build(tol, 0.02);
  const bytes = JSON.stringify(data).length;
  console.log(`tol=${tol}  points=${points}  bytes=${bytes}`);
  if (bytes <= TARGET && !chosen) chosen = { tol, data, points, bytes };
}

if (!chosen) throw new Error("no tolerance met the target");
console.log(`\nchosen tolerance ${chosen.tol} -> ${chosen.points} points, ${chosen.bytes} bytes`);
writeFileSync("india.simplified.json", JSON.stringify(chosen.data));
