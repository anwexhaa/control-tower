/* ============================================================================
   Web Mercator, written out rather than imported.

   The whole map is built on two functions and a three-number view. Geography
   is projected once into a fixed "world" square; pan and zoom are a scale and
   a translation applied on top. That split is what keeps panning cheap — the
   SVG layer only ever updates one transform attribute, and the canvas layer
   multiplies through the same three numbers.
   ========================================================================== */

/** Side of the projected world square, in world units. */
export const WORLD = 4096;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Pan and zoom. Screen = world * k + (tx, ty). */
export interface View {
  k: number;
  tx: number;
  ty: number;
}

const DEG = Math.PI / 180;
/** Mercator diverges at the poles; clamp to the standard web limit. */
const MAX_LAT = 85.05112878;

export function project(lat: number, lng: number): Point {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const s = Math.sin(clamped * DEG);
  return {
    x: WORLD * (0.5 + lng / 360),
    y: WORLD * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)),
  };
}

export function unproject(x: number, y: number): LatLng {
  const n = Math.PI * (1 - (2 * y) / WORLD);
  return {
    lng: (x / WORLD - 0.5) * 360,
    lat: Math.atan(Math.sinh(n)) / DEG,
  };
}

export function toScreen(p: Point, view: View): Point {
  return { x: p.x * view.k + view.tx, y: p.y * view.k + view.ty };
}

export function toWorld(sx: number, sy: number, view: View): Point {
  return { x: (sx - view.tx) / view.k, y: (sy - view.ty) / view.k };
}

/** Screen pixel straight to a coordinate — used by the cursor readout. */
export function screenToLatLng(sx: number, sy: number, view: View): LatLng {
  const w = toWorld(sx, sy, view);
  return unproject(w.x, w.y);
}

export interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** The view that fits `bounds` into a viewport, with padding in screen pixels. */
export function fitBounds(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 24,
): View {
  const a = project(bounds.maxLat, bounds.minLng); // top-left
  const b = project(bounds.minLat, bounds.maxLng); // bottom-right

  const w = Math.max(1e-6, b.x - a.x);
  const h = Math.max(1e-6, b.y - a.y);

  const k = Math.min((width - padding * 2) / w, (height - padding * 2) / h);
  return {
    k,
    tx: (width - (a.x + b.x) * k) / 2,
    ty: (height - (a.y + b.y) * k) / 2,
  };
}

/** Zoom about a fixed screen point, so the map grows under the cursor. */
export function zoomAbout(
  view: View,
  sx: number,
  sy: number,
  factor: number,
  limits: { min: number; max: number },
): View {
  const k = Math.max(limits.min, Math.min(limits.max, view.k * factor));
  if (k === view.k) return view;
  // Keep the world point under (sx, sy) where it is.
  const w = toWorld(sx, sy, view);
  return { k, tx: sx - w.x * k, ty: sy - w.y * k };
}

/* -------------------------------------------------------------- distance --- */

const EARTH_KM = 6371.0088;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing in degrees, 0 = north. Used to point the truck glyphs. */
export function bearing(a: LatLng, b: LatLng): number {
  const dLng = (b.lng - a.lng) * DEG;
  const y = Math.sin(dLng) * Math.cos(b.lat * DEG);
  const x =
    Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) -
    Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos(dLng);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Great-circle interpolation. Straight lerp visibly cuts corners on long lanes. */
export function interpolate(a: LatLng, b: LatLng, f: number): LatLng {
  const φ1 = a.lat * DEG, λ1 = a.lng * DEG;
  const φ2 = b.lat * DEG, λ2 = b.lng * DEG;

  const dφ = φ2 - φ1, dλ = λ2 - λ1;
  const h =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const δ = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  if (δ < 1e-9) return { lat: a.lat, lng: a.lng };

  const A = Math.sin((1 - f) * δ) / Math.sin(δ);
  const B = Math.sin(f * δ) / Math.sin(δ);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG,
    lng: Math.atan2(y, x) / DEG,
  };
}
