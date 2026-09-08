import { useState } from "react";
import { cx } from "../../lib/cx";
import { ON_TIME_TARGET_PCT, type HeatBucket, type HeatRow } from "./aggregate";

/* Corridors against recent windows, shaded by on-time performance.

   Diverging rather than sequential, because on-time percentage has a meaningful
   midpoint — the 90% the network is held to. Above it and below it are
   different situations, not more and less of one, so the scale runs from the
   critical hue through a neutral at target to the healthy one.

   Volume is the second encoding, carried in the row rather than the cell, so
   the colour never has to mean two things at once. */

/** Steps out from the target. Neutral sits at the target itself. */
const STEPS = [
  { max: 60, mix: 78, token: "--color-crit" },
  { max: 75, mix: 55, token: "--color-crit" },
  { max: 86, mix: 32, token: "--color-crit" },
  { max: 94, mix: 26, token: "--color-idle" },
  { max: 98, mix: 40, token: "--color-ok" },
  { max: 100.1, mix: 68, token: "--color-ok" },
] as const;

function fillFor(pct: number): string {
  const step = STEPS.find((s) => pct < s.max) ?? STEPS[STEPS.length - 1];
  // Mixed against the panel so the ramp reads the same way on either ground.
  return `color-mix(in oklab, var(${step.token}) ${step.mix}%, var(--color-panel))`;
}

export function LaneHeat({
  buckets,
  rows,
}: {
  buckets: HeatBucket[];
  rows: HeatRow[];
}) {
  const [hover, setHover] = useState<{ lane: string; bucket: number } | null>(null);

  if (rows.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[12.5px] text-ink-mute">
        No corridor has completed a delivery yet.
      </p>
    );
  }

  const active =
    hover !== null
      ? rows.find((r) => r.laneId === hover.lane)?.cells[hover.bucket] ?? null
      : null;
  const activeLane = hover !== null ? rows.find((r) => r.laneId === hover.lane) : null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            On-time delivery by corridor over the last {buckets.length * 4} hours
          </caption>
          <thead>
            <tr>
              <th className="w-[200px] pb-1.5 text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                Corridor
              </th>
              <th className="w-[54px] pb-1.5 text-right text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                Trips
              </th>
              {buckets.map((b) => (
                <th
                  key={b.at}
                  scope="col"
                  className="pb-1.5 text-center font-mono text-[10px] font-medium text-ink-faint"
                >
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.laneId}>
                <th
                  scope="row"
                  className="truncate py-0.5 pr-2 text-[11.5px] font-normal text-ink-soft"
                >
                  {row.label}
                </th>
                <td className="py-0.5 pr-2 text-right font-mono text-[11px] tabular-nums text-ink-faint">
                  {row.volume}
                </td>
                {row.cells.map((cell, i) => (
                  <td key={i} className="p-[1px]">
                    <div
                      onPointerEnter={() => setHover({ lane: row.laneId, bucket: i })}
                      onPointerLeave={() => setHover(null)}
                      title={
                        cell.onTimePct === null
                          ? "No delivery in this window"
                          : `${cell.onTimePct.toFixed(0)}% on time, ${cell.delivered} delivered`
                      }
                      className={cx(
                        "h-6 rounded-xs transition-[outline] outline-offset-[-1px]",
                        cell.onTimePct === null
                          ? "border border-dashed border-line"
                          : "outline-2 outline-transparent",
                        hover?.lane === row.laneId && hover.bucket === i && "outline-ink",
                      )}
                      style={
                        cell.onTimePct === null
                          ? undefined
                          : { background: fillFor(cell.onTimePct) }
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* scale key — the ramp has to be readable without hovering it */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] text-ink-faint">
        <span>Below target</span>
        <span className="flex items-center gap-px" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={i}
              className="inline-block h-3 w-6 first:rounded-l-xs last:rounded-r-xs"
              style={{
                background: `color-mix(in oklab, var(${s.token}) ${s.mix}%, var(--color-panel))`,
              }}
            />
          ))}
        </span>
        <span>Above</span>
        <span className="text-ink-mute">
          neutral at the {ON_TIME_TARGET_PCT}% target
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-6 rounded-xs border border-dashed border-line"
          />
          no delivery
        </span>

        <span className="ml-auto min-h-[16px] text-ink-soft">
          {active && activeLane
            ? active.onTimePct === null
              ? `${activeLane.label} — nothing landed in that window`
              : `${activeLane.label} — ${active.onTimePct.toFixed(0)}% on time across ${active.delivered} delivered`
            : ""}
        </span>
      </div>
    </div>
  );
}
