import { duration, num } from "../domain/format";
import { worstOpen } from "../domain/kpis";
import { LANE_BY_ID, laneLabel } from "../domain/lanes";
import { transporterName } from "../domain/transporters";
import type { Trip, TripState } from "../domain/types";
import { cx } from "../lib/cx";
import { Chip, StatusPill } from "../ui";
import { STATUS_LABEL, STATUS_TONE } from "../features/track/present";

/* The map, as a list.

   A canvas of 1,100 rotated triangles is not readable by anything but an eye.
   Rather than bolt ARIA onto the canvas and pretend, the same data has a real
   list rendering — reachable by everyone, not hidden behind a screen-reader-only
   class, because sighted keyboard users want it too on a bad connection. */

const SEVERITY_TONE = {
  critical: "crit",
  high: "warn",
  medium: "info",
  low: "neutral",
} as const;

export function MapListView({
  trips,
  states,
  selectedId,
  onSelect,
  limit = 200,
}: {
  trips: readonly Trip[];
  states: ReadonlyMap<string, TripState>;
  selectedId: string | null;
  onSelect: (tripId: string) => void;
  limit?: number;
}) {
  // Worst first: the list has the same priority order as the eye would apply.
  const rows = [...trips]
    .filter((t) => states.get(t.id)?.status !== "planned")
    .sort((a, b) => {
      const sa = states.get(a.id)!;
      const sb = states.get(b.id)!;
      const rank = (s: TripState) => (s.status === "at_risk" ? 0 : s.status === "in_transit" ? 1 : 2);
      return rank(sa) - rank(sb) || sb.delayHours - sa.delayHours;
    })
    .slice(0, limit);

  return (
    <div className="h-full overflow-auto">
      <p className="border-b border-line-soft px-3 py-2 text-[11.5px] text-ink-mute">
        {num(rows.length)} vehicles on the road, worst first. The same fleet the map
        draws.
      </p>

      <ul className="flex flex-col">
        {rows.map((t) => {
          const s = states.get(t.id)!;
          const worst = worstOpen(s.exceptions);
          const lane = LANE_BY_ID.get(t.laneId)!;

          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                aria-current={t.id === selectedId ? "true" : undefined}
                className={cx(
                  "flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line-soft px-3 py-2 text-left",
                  t.id === selectedId ? "bg-accent-soft" : "hover:bg-hover",
                )}
              >
                <span className="font-mono text-[11.5px] text-ink">{t.docs.lrNo}</span>
                <StatusPill tone={STATUS_TONE[s.status]}>
                  {STATUS_LABEL[s.status]}
                </StatusPill>
                {worst && (
                  <Chip tone={SEVERITY_TONE[worst.severity]} mono>
                    {worst.code}
                  </Chip>
                )}
                <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">
                  {Math.round(s.progress * 100)}% ·{" "}
                  {s.delayHours > 0 ? `${duration(s.delayHours)} late` : "on time"}
                </span>
                <span className="w-full truncate text-[11.5px] text-ink-soft">
                  {laneLabel(lane)} · {transporterName(t.transporterCode)} ·{" "}
                  <span className="font-mono">{t.vehicle.regNo}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
