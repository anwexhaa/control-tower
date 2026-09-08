import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { LANE_BY_ID, laneLabel } from "../domain/lanes";
import { duration, istDateTime } from "../domain/format";
import { transporterName } from "../domain/transporters";
import type { Trip, TripState } from "../domain/types";
import { cx } from "../lib/cx";
import { Toggle, Tooltip } from "../ui";
import { INDIA_SHAPES, MAINLAND_BOUNDS, BOUNDARY_POINTS } from "./geodata";
import { buildMarkers, drawFleet, readPalette, type Marker } from "./fleet";
import { fitBounds, screenToLatLng, zoomAbout, WORLD, type View } from "./projection";
import { Quadtree } from "./quadtree";
import { drawLanes, drawNodes } from "./scene";

/* The live network view.

   Geography is a static SVG layer that never re-renders — pan and zoom are one
   transform attribute. The fleet, corridors and nodes are drawn on a canvas
   above it, because 1,200 markers as DOM nodes will not hold 60 fps.

   The quadtree is indexed in WORLD space rather than screen space, so panning
   and zooming never rebuild it. It is rebuilt only when the fleet moves, once
   a second. */

const H = 3_600_000;

interface Layers {
  lanes: boolean;
  nodes: boolean;
  labels: boolean;
  exceptionsOnly: boolean;
  heat: boolean;
}

const DEFAULT_LAYERS: Layers = {
  lanes: true,
  nodes: true,
  labels: false,
  exceptionsOnly: false,
  heat: false,
};

export function NetworkMap({
  trips,
  states,
  now,
  selectedId,
  onSelect,
}: {
  trips: readonly Trip[];
  states: ReadonlyMap<string, TripState>;
  now: number;
  selectedId: string | null;
  onSelect: (tripId: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [hover, setHover] = useState<{ marker: Marker; x: number; y: number } | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);
  /** Cost of the last scene draw. Surfaced so the budget is observable. */
  const [drawMs, setDrawMs] = useState(0);

  const fitK = useRef(1);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  /* ------------------------------------------------------------- sizing --- */

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w < 40 || size.h < 40) return;
    setView((current) => {
      const fitted = fitBounds(MAINLAND_BOUNDS, size.w, size.h, 18);
      fitK.current = fitted.k;
      // Keep the user's pan across a resize; only fit on first measure.
      return current ?? fitted;
    });
  }, [size.w, size.h]);

  /* --------------------------------------------------------- theme watch --- */

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((n) => n + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  /* -------------------------------------------------------------- markers --- */

  const markers = useMemo(
    () => buildMarkers(trips, states, now, { exceptionsOnly: layers.exceptionsOnly }),
    [trips, states, now, layers.exceptionsOnly],
  );

  /** Mean delay per corridor, for the heat overlay. */
  const heat = useMemo(() => {
    if (!layers.heat) return null;
    const sum = new Map<string, { total: number; n: number }>();
    for (const trip of trips) {
      const s = states.get(trip.id);
      if (!s || (s.status !== "in_transit" && s.status !== "at_risk")) continue;
      const entry = sum.get(trip.laneId) ?? { total: 0, n: 0 };
      entry.total += s.delayHours;
      entry.n++;
      sum.set(trip.laneId, entry);
    }
    return {
      get(laneId: string) {
        const e = sum.get(laneId);
        return e && e.n > 0 ? e.total / e.n : null;
      },
    };
  }, [layers.heat, trips, states]);

  /* Indexed in world space, so pan and zoom do not invalidate it. */
  const tree = useMemo(() => {
    const qt = new Quadtree<Marker>(0, 0, WORLD, WORLD);
    for (const m of markers) qt.insert({ x: m.wx, y: m.wy, value: m });
    return qt;
  }, [markers]);

  /* -------------------------------------------------------------- drawing --- */

  const clusterCellPx = view && view.k < fitK.current * 2.4 ? 26 : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host || !view || size.w === 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
      canvas.width = size.w * dpr;
      canvas.height = size.h * dpr;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette = readPalette(host);
    const started = performance.now();
    ctx.clearRect(0, 0, size.w, size.h);

    if (layers.lanes) drawLanes(ctx, view, palette, { heat, width: size.w, height: size.h });
    if (layers.nodes) {
      drawNodes(ctx, view, palette, {
        width: size.w,
        height: size.h,
        labels: layers.labels && view.k > fitK.current * 1.8,
      });
    }
    drawFleet(ctx, markers, view, palette, {
      width: size.w,
      height: size.h,
      selectedId,
      clusterCellPx,
    });

    // Smoothed so the readout is legible rather than flickering every frame.
    const elapsed = performance.now() - started;
    setDrawMs((prev) => (prev === 0 ? elapsed : prev * 0.8 + elapsed * 0.2));
  }, [view, markers, size, layers, heat, selectedId, clusterCellPx, themeTick]);

  /* --------------------------------------------------------- interaction --- */

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    setHover(null);
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const host = hostRef.current;
      if (!host || !view) return;
      const rect = host.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (drag.current) {
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        drag.current.moved += Math.abs(dx) + Math.abs(dy);
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        setView((v) => (v ? { ...v, tx: v.tx + dx, ty: v.ty + dy } : v));
        return;
      }

      setCursor(screenToLatLng(sx, sy, view));

      // Query in world space with the radius scaled back through the zoom.
      const wx = (sx - view.tx) / view.k;
      const wy = (sy - view.ty) / view.k;
      const found = tree.nearest(wx, wy, 11 / view.k);
      setHover(found ? { marker: found.value, x: sx, y: sy } : null);
    },
    [tree, view],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const moved = drag.current?.moved ?? 0;
      drag.current = null;
      if (moved > 4 || !view) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const wx = (e.clientX - rect.left - view.tx) / view.k;
      const wy = (e.clientY - rect.top - view.ty) / view.k;
      const found = tree.nearest(wx, wy, 12 / view.k);
      onSelect(found ? found.value.tripId : null);
    },
    [onSelect, tree, view],
  );

  const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = Math.pow(1.0015, -e.deltaY);
    setView((v) =>
      v
        ? zoomAbout(v, sx, sy, factor, {
            min: fitK.current * 0.75,
            max: fitK.current * 40,
          })
        : v,
    );
  }, []);

  const resetView = useCallback(() => {
    if (size.w < 40) return;
    const fitted = fitBounds(MAINLAND_BOUNDS, size.w, size.h, 18);
    fitK.current = fitted.k;
    setView(fitted);
  }, [size.w, size.h]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 120 : 40;
      const nudge = (dx: number, dy: number) => {
        e.preventDefault();
        setView((v) => (v ? { ...v, tx: v.tx + dx, ty: v.ty + dy } : v));
      };
      switch (e.key) {
        case "ArrowLeft": return nudge(step, 0);
        case "ArrowRight": return nudge(-step, 0);
        case "ArrowUp": return nudge(0, step);
        case "ArrowDown": return nudge(0, -step);
        case "+":
        case "=":
          e.preventDefault();
          return setView((v) =>
            v ? zoomAbout(v, size.w / 2, size.h / 2, 1.3, { min: fitK.current * 0.75, max: fitK.current * 40 }) : v,
          );
        case "-":
        case "_":
          e.preventDefault();
          return setView((v) =>
            v ? zoomAbout(v, size.w / 2, size.h / 2, 1 / 1.3, { min: fitK.current * 0.75, max: fitK.current * 40 }) : v,
          );
        case "0":
        case "Home":
          e.preventDefault();
          return resetView();
        case "Escape":
          return onSelect(null);
      }
    },
    [onSelect, resetView, size.h, size.w],
  );

  /* ----------------------------------------------------------------- card --- */

  const hoverTrip = hover ? trips.find((t) => t.id === hover.marker.tripId) : null;
  const hoverState = hoverTrip ? states.get(hoverTrip.id) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={hostRef}
        role="application"
        aria-label="Live freight network map of India. Arrow keys pan, plus and minus zoom, 0 resets. The trips table below lists every vehicle shown here."
        tabIndex={0}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHover(null);
          setCursor(null);
        }}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        {/* Geography: static, never re-rendered. Pan and zoom are the transform. */}
        <svg
          width={size.w}
          height={size.h}
          className="absolute inset-0 block"
          aria-hidden="true"
        >
          <g
            transform={view ? `translate(${view.tx} ${view.ty}) scale(${view.k})` : undefined}
          >
            {INDIA_SHAPES.map((s) => (
              <path
                key={s.name}
                d={s.d}
                className="fill-sunken stroke-line-strong"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        </svg>

        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 block"
          style={{ width: size.w, height: size.h }}
          aria-hidden="true"
        />
      </div>

      {/* hover card */}
      {hover && hoverTrip && hoverState && (
        <div
          className="pointer-events-none absolute z-20 w-[248px] rounded-sm border border-line bg-raised p-2.5 shadow-lg"
          style={{
            left: Math.min(hover.x + 14, Math.max(0, size.w - 258)),
            top: Math.min(hover.y + 14, Math.max(0, size.h - 130)),
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[11.5px] font-medium text-ink">
              {hoverTrip.docs.lrNo}
            </span>
            <span className="font-mono text-[10.5px] text-ink-faint tabular-nums">
              {Math.round(hoverState.progress * 100)}%
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] text-ink-soft">
            {laneLabel(LANE_BY_ID.get(hoverTrip.laneId)!)}
          </p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
            <dt className="text-ink-faint">Transporter</dt>
            <dd className="truncate text-ink-soft">
              {transporterName(hoverTrip.transporterCode)}
            </dd>
            <dt className="text-ink-faint">Vehicle</dt>
            <dd className="font-mono text-ink-soft">{hoverTrip.vehicle.regNo}</dd>
            <dt className="text-ink-faint">ETA</dt>
            <dd className="font-mono text-ink-soft">{istDateTime(hoverState.etaAt)}</dd>
            <dt className="text-ink-faint">Against commit</dt>
            <dd
              className={cx(
                "font-mono",
                hoverState.delayHours > 0 ? "text-warn" : "text-ok",
              )}
            >
              {hoverState.delayHours > 0
                ? `+${duration(hoverState.delayHours)}`
                : `−${duration((hoverTrip.slaCommitAt - hoverState.etaAt) / H)}`}
            </dd>
          </dl>
        </div>
      )}

      {/* layer controls */}
      <div className="absolute top-2 left-2 z-10 rounded-sm border border-line bg-panel/92 p-2 backdrop-blur-sm">
        <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.11em] text-ink-faint uppercase">
          Layers
        </div>
        <div className="flex flex-col gap-1.5">
          {(
            [
              ["lanes", "Corridors"],
              ["nodes", "Plants & ports"],
              ["labels", "Labels"],
              ["exceptionsOnly", "Exceptions only"],
              ["heat", "Delay heat"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <Toggle
                checked={layers[key]}
                onChange={(v) => setLayers((l) => ({ ...l, [key]: v }))}
                label={label}
              />
              <span className="text-[11.5px] text-ink-soft select-none">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* readout */}
      <div className="absolute right-2 bottom-2 z-10 flex items-center gap-3 rounded-sm border border-line bg-panel/92 px-2 py-1 font-mono text-[10px] text-ink-faint backdrop-blur-sm">
        <Tooltip label={`${BOUNDARY_POINTS.toLocaleString()} boundary points, simplified`} side="top">
          <span className="tabular-nums">{markers.length} shown</span>
        </Tooltip>
        <span className="tabular-nums">
          {view ? `${(view.k / fitK.current).toFixed(1)}×` : "—"}
        </span>
        <Tooltip label="Canvas scene draw: corridors, nodes and the whole fleet" side="top">
          <span className="tabular-nums" data-draw-ms={drawMs.toFixed(2)}>
            {drawMs.toFixed(1)} ms
          </span>
        </Tooltip>
        <span className="tabular-nums">
          {cursor ? `${cursor.lat.toFixed(2)}°N ${cursor.lng.toFixed(2)}°E` : "—"}
        </span>
        <button
          type="button"
          onClick={resetView}
          className="text-ink-mute transition-colors hover:text-ink"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
