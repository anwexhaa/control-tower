import { useMemo } from "react";
import { nodeName } from "../../domain/nodes";
import { LANE_BY_ID } from "../../domain/lanes";
import type { Trip, TripState } from "../../domain/types";
import { project, type LatLng } from "../../map/projection";
import { placeOnRoute, routeFor } from "../../map/route";
import { pingFixes, trailSegments } from "./telemetry";

/* An inset of the corridor with the road actually travelled drawn on it.

   Stretches where telemetry was dark are dashed rather than joined into the
   solid line: a control tower that quietly interpolates across a coverage hole
   is asserting a position nobody reported. */

const W = 520;
const HGT = 132;
const PAD = 14;

export function PingTrail({
  trip,
  state,
  now,
}: {
  trip: Trip;
  state: TripState;
  now: number;
}) {
  const lane = LANE_BY_ID.get(trip.laneId)!;

  const view = useMemo(() => {
    const route = routeFor(trip.laneId);
    const pts = route.world;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const k = Math.min((W - PAD * 2) / spanX, (HGT - PAD * 2) / spanY);

    const toScreen = (ll: LatLng) => {
      const p = project(ll.lat, ll.lng);
      return {
        x: (p.x - minX) * k + (W - spanX * k) / 2,
        y: (p.y - minY) * k + (HGT - spanY * k) / 2,
      };
    };

    const path = (points: LatLng[]) =>
      points
        .map((ll, i) => {
          const s = toScreen(ll);
          return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        })
        .join("");

    return { toScreen, path, route };
  }, [trip.laneId]);

  const segments = useMemo(
    () => trailSegments(trip, state, now),
    [trip, state, now],
  );
  const fixes = useMemo(() => pingFixes(trip, state, now), [trip, state, now]);

  const here = placeOnRoute(view.route, state.progress);
  const cursor = view.toScreen(here);
  const origin = view.toScreen(view.route.points[0]);
  const dest = view.toScreen(view.route.points[view.route.points.length - 1]);
  const darkCount = segments.filter((s) => s.dark).length;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${HGT}`}
        className="block w-full rounded-sm border border-line-soft bg-sunken"
        role="img"
        aria-label={`Route travelled from ${nodeName(lane.originCode)} to ${nodeName(lane.destCode)}, ${Math.round(state.progress * 100)} per cent covered`}
      >
        {/* the whole corridor, faint */}
        <path
          d={view.path(view.route.points)}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* what has actually been travelled */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={view.path(seg.points)}
            fill="none"
            stroke={seg.dark ? "var(--color-warn)" : "var(--color-accent)"}
            strokeWidth={seg.dark ? 1.5 : 2}
            strokeDasharray={seg.dark ? "3 3" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* reported fixes */}
        {fixes.map((f, i) => {
          const s = view.toScreen(f);
          return <circle key={i} cx={s.x} cy={s.y} r={1.6} fill="var(--color-accent)" opacity={0.7} />;
        })}

        {/* endpoints */}
        <circle cx={origin.x} cy={origin.y} r={3.5} fill="var(--color-panel)" stroke="var(--color-ink-mute)" strokeWidth={1.5} />
        <circle cx={dest.x} cy={dest.y} r={3.5} fill="var(--color-panel)" stroke="var(--color-ink-mute)" strokeWidth={1.5} />

        {/* where it is now */}
        {state.status !== "planned" && (
          <>
            <circle cx={cursor.x} cy={cursor.y} r={6} fill="var(--color-accent)" opacity={0.2} />
            <circle cx={cursor.x} cy={cursor.y} r={3} fill="var(--color-accent)" />
          </>
        )}
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
        <span>{nodeName(lane.originCode)}</span>
        <span aria-hidden="true">→</span>
        <span>{nodeName(lane.destCode)}</span>
        <span className="ml-auto font-mono tabular-nums">
          {Math.round(state.coveredKm)} / {lane.distanceKm} km
        </span>
        {darkCount > 0 && (
          <span className="flex items-center gap-1 text-warn">
            <span aria-hidden="true" className="inline-block h-px w-4 border-t border-dashed border-warn" />
            {darkCount} dark {darkCount === 1 ? "stretch" : "stretches"}
          </span>
        )}
      </div>
    </div>
  );
}
