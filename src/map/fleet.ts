import { SEVERITY_RANK } from "../domain/exceptions";
import type { Trip, TripState } from "../domain/types";
import { project, type View } from "./projection";
import { placeOnRoute, routeFor } from "./route";

/* Building and drawing the fleet layer.

   1,200 markers as DOM nodes will not hold 60 fps, so geography stays on SVG
   (static, one transform) and the fleet goes on canvas above it. Markers are
   batched into one path per colour and filled four times a frame rather than
   stroked individually. */

export type MarkerTone = "ok" | "info" | "warn" | "crit";

export interface Marker {
  tripId: string;
  /** World coordinates — screen position is the view transform applied. */
  wx: number;
  wy: number;
  /** Degrees, 0 = north. */
  heading: number;
  tone: MarkerTone;
  /** Delivered trips sit still at the destination and draw smaller. */
  stationary: boolean;
  /** A critical raised in the last half hour of sim time, drawn with a halo. */
  fresh: boolean;
}

const FRESH_WINDOW_MS = 30 * 60 * 1000;

export interface MarkerOptions {
  /** Drop everything that is not carrying an open exception. */
  exceptionsOnly?: boolean;
}

export function buildMarkers(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  now: number,
  options: MarkerOptions = {},
): Marker[] {
  const markers: Marker[] = [];

  for (const trip of trips) {
    const s = states.get(trip.id);
    if (!s || s.status === "planned") continue;

    let worst: (typeof s.exceptions)[number] | null = null;
    for (const e of s.exceptions) {
      if (e.resolvedAt !== null) continue;
      if (!worst || SEVERITY_RANK[e.severity] < SEVERITY_RANK[worst.severity]) worst = e;
    }
    if (options.exceptionsOnly && !worst) continue;

    const place = placeOnRoute(routeFor(trip.laneId), s.progress);
    const p = project(place.lat, place.lng);

    const tone: MarkerTone =
      worst?.severity === "critical"
        ? "crit"
        : worst?.severity === "high"
          ? "warn"
          : s.status === "delivered"
            ? "ok"
            : "info";

    markers.push({
      tripId: trip.id,
      wx: p.x,
      wy: p.y,
      heading: place.heading,
      tone,
      stationary: s.status === "delivered",
      fresh:
        worst?.severity === "critical" &&
        worst.acknowledgedAt === null &&
        now - worst.raisedAt < FRESH_WINDOW_MS,
    });
  }

  return markers;
}

/* -------------------------------------------------------------- drawing --- */

export interface Cluster {
  x: number;
  y: number;
  count: number;
  /** Worst tone in the cell, so a cluster hiding a critical still reads red. */
  tone: MarkerTone;
}

const TONE_RANK: Record<MarkerTone, number> = { crit: 0, warn: 1, info: 2, ok: 3 };

/** Grid clustering in screen space. Cheap, stable, and good enough at zoom. */
export function clusterMarkers(
  markers: readonly Marker[],
  view: View,
  cellPx: number,
): { clusters: Cluster[]; singles: Marker[] } {
  const cells = new Map<number, { sx: number; sy: number; n: number; tone: MarkerTone; first: Marker }>();

  for (const m of markers) {
    const x = m.wx * view.k + view.tx;
    const y = m.wy * view.k + view.ty;
    const cx = Math.floor(x / cellPx);
    const cy = Math.floor(y / cellPx);
    const key = cx * 100_000 + cy;

    const cell = cells.get(key);
    if (!cell) {
      cells.set(key, { sx: x, sy: y, n: 1, tone: m.tone, first: m });
    } else {
      cell.sx += x;
      cell.sy += y;
      cell.n++;
      if (TONE_RANK[m.tone] < TONE_RANK[cell.tone]) cell.tone = m.tone;
    }
  }

  const clusters: Cluster[] = [];
  const singles: Marker[] = [];
  for (const cell of cells.values()) {
    if (cell.n < 3) {
      singles.push(cell.first);
      // A cell of two still draws both, so nothing silently disappears.
      if (cell.n === 2) singles.push(cell.first);
    } else {
      clusters.push({ x: cell.sx / cell.n, y: cell.sy / cell.n, count: cell.n, tone: cell.tone });
    }
  }
  return { clusters, singles };
}

export interface PaletteSource {
  ok: string;
  info: string;
  warn: string;
  crit: string;
  ink: string;
  panel: string;
}

/** Colours come from the live token values, so the map follows the theme. */
export function readPalette(el: HTMLElement): PaletteSource {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    ok: v("--color-ok"),
    info: v("--color-info"),
    warn: v("--color-warn"),
    crit: v("--color-crit"),
    ink: v("--color-ink"),
    panel: v("--color-panel"),
  };
}

const DEG = Math.PI / 180;

/**
 * Draws the whole fleet. Markers are accumulated into one Path2D per tone and
 * filled once — no per-marker save/restore, no per-marker transform.
 */
export function drawFleet(
  ctx: CanvasRenderingContext2D,
  markers: readonly Marker[],
  view: View,
  palette: PaletteSource,
  options: { width: number; height: number; selectedId?: string | null; clusterCellPx: number },
): void {
  const { width, height, selectedId, clusterCellPx } = options;
  ctx.clearRect(0, 0, width, height);

  const shouldCluster = clusterCellPx > 0;
  const { clusters, singles } = shouldCluster
    ? clusterMarkers(markers, view, clusterCellPx)
    : { clusters: [] as Cluster[], singles: markers as Marker[] };

  const paths: Record<MarkerTone, Path2D> = {
    ok: new Path2D(),
    info: new Path2D(),
    warn: new Path2D(),
    crit: new Path2D(),
  };
  const halos = new Path2D();
  let selected: { x: number; y: number } | null = null;

  for (const m of singles) {
    const x = m.wx * view.k + view.tx;
    const y = m.wy * view.k + view.ty;
    if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;

    if (m.tripId === selectedId) selected = { x, y };

    if (m.stationary) {
      // Delivered: a small dot at the gate, not an arrow.
      const p = paths[m.tone];
      p.moveTo(x + 2.4, y);
      p.arc(x, y, 2.4, 0, Math.PI * 2);
      continue;
    }

    // Rotated triangle, vertices computed directly — cheaper than transforms.
    const a = m.heading * DEG;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const nose = 5.2;
    const tail = 3.4;
    const half = 3.0;

    const p = paths[m.tone];
    p.moveTo(x + sin * nose, y - cos * nose);
    p.lineTo(x - sin * tail + cos * half, y + cos * tail + sin * half);
    p.lineTo(x - sin * tail - cos * half, y + cos * tail - sin * half);
    p.closePath();

    if (m.fresh) {
      halos.moveTo(x + 9, y);
      halos.arc(x, y, 9, 0, Math.PI * 2);
    }
  }

  // Halos first so markers sit on top of their own glow.
  ctx.fillStyle = palette.crit;
  ctx.globalAlpha = 0.18;
  ctx.fill(halos);
  ctx.globalAlpha = 1;

  for (const tone of ["ok", "info", "warn", "crit"] as const) {
    ctx.fillStyle = palette[tone];
    ctx.fill(paths[tone]);
  }

  // Clusters last: they are summaries and should sit above the detail.
  if (clusters.length) {
    ctx.font =
      "600 10px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const c of clusters) {
      if (c.x < -30 || c.y < -30 || c.x > width + 30 || c.y > height + 30) continue;
      const r = Math.min(17, 8 + Math.log2(c.count) * 2.4);

      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = palette.panel;
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = palette[c.tone];
      ctx.stroke();

      ctx.fillStyle = palette.ink;
      ctx.fillText(String(c.count), c.x, c.y + 0.5);
    }
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(selected.x, selected.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
