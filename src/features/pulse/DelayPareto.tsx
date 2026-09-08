import { useState } from "react";
import { EXCEPTION_DEFS } from "../../domain/exceptions";
import { num } from "../../domain/format";
import { ticks } from "../../charts/scale";
import type { ParetoRow } from "./aggregate";

/* Which conditions account for most of what the tower is dealing with.

   Both series are percentages, so they share one axis. A Pareto is the usual
   home of the dual-axis mistake — counts on the left, cumulative percent on the
   right — and two y-scales let you imply any crossing point you like. Plotting
   share and cumulative share on the same 0–100 axis says the same thing and
   cannot mislead. */

const W = 640;
const HGT = 260;
const PAD = { top: 14, right: 14, bottom: 52, left: 40 };

const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = HGT - PAD.top - PAD.bottom;

export function DelayPareto({ rows }: { rows: ParetoRow[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[12.5px] text-ink-mute">
        Nothing has been raised against the board yet.
      </p>
    );
  }

  const y = (pct: number) => PAD.top + PLOT_H - (pct / 100) * PLOT_H;
  const bandW = PLOT_W / rows.length;
  const barW = Math.min(38, bandW * 0.6);
  const cx = (i: number) => PAD.left + bandW * (i + 0.5);

  const gridlines = ticks(0, 100, 4);
  const cumulative = rows
    .map((r, i) => `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)} ${y(r.cumulativePct).toFixed(1)}`)
    .join("");

  // Where the top few codes cross 80% — the number a Pareto exists to give.
  const eightyIndex = rows.findIndex((r) => r.cumulativePct >= 80);
  const active = hover !== null ? rows[hover] : null;

  return (
    <div>
      {/* legend — two series, so identity is never colour alone */}
      <div className="mb-2 flex items-center gap-4 text-[11px] text-ink-mute">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-xs bg-accent" aria-hidden="true" />
          Share of exceptions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 bg-ink" aria-hidden="true" />
          Cumulative
        </span>
        {eightyIndex >= 0 && (
          <span className="ml-auto text-ink-faint">
            {eightyIndex + 1} of {rows.length} codes account for 80%
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${HGT}`}
        className="block w-full"
        role="img"
        aria-label={`Exception Pareto. ${rows
          .slice(0, 3)
          .map((r) => `${r.code} ${r.sharePct.toFixed(0)} per cent`)
          .join(", ")}.`}
        onPointerLeave={() => setHover(null)}
      >
        {/* recessive grid, labelled with values the chart reaches */}
        {gridlines.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-line)"
              strokeWidth={1}
              opacity={0.7}
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize="9.5"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--color-ink-faint)"
            >
              {t}%
            </text>
          </g>
        ))}

        {/* the 80% reference a Pareto is read against */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(80)}
          y2={y(80)}
          stroke="var(--color-warn)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.8}
        />

        {rows.map((r, i) => {
          const h = Math.max(2, PLOT_H - (y(r.sharePct) - PAD.top));
          return (
            <g key={r.code}>
              {/* hit target wider than the mark */}
              <rect
                x={PAD.left + bandW * i}
                y={PAD.top}
                width={bandW}
                height={PLOT_H}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
              />
              <rect
                x={cx(i) - barW / 2}
                y={y(r.sharePct)}
                width={barW}
                height={h}
                rx={4}
                fill="var(--color-accent)"
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <text
                x={cx(i)}
                y={HGT - 32}
                textAnchor="middle"
                fontSize="9.5"
                fontFamily="'IBM Plex Mono', monospace"
                fill={hover === i ? "var(--color-ink)" : "var(--color-ink-mute)"}
              >
                {r.code}
              </text>
              <text
                x={cx(i)}
                y={HGT - 20}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-ink-faint)"
              >
                {r.count}
              </text>
            </g>
          );
        })}

        {/* cumulative — a different mark type as well as a different colour */}
        <path
          d={cumulative}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {rows.map((r, i) => (
          <circle
            key={r.code}
            cx={cx(i)}
            cy={y(r.cumulativePct)}
            r={hover === i ? 4.5 : 3}
            fill="var(--color-ink)"
            stroke="var(--color-panel)"
            strokeWidth={2}
          />
        ))}
      </svg>

      {/* hover readout, rather than a number on every mark */}
      <div className="mt-1 min-h-[32px] text-[11.5px]">
        {active ? (
          <span className="text-ink-soft">
            <span className="font-mono text-ink">{active.code}</span> ·{" "}
            {EXCEPTION_DEFS[active.code].label} — {num(active.count)} raised,{" "}
            {active.sharePct.toFixed(1)}% of all exceptions, {active.cumulativePct.toFixed(1)}%
            cumulative
          </span>
        ) : (
          <span className="text-ink-faint">
            Hover a bar for the count and cumulative share. Dashed line marks 80%.
          </span>
        )}
      </div>
    </div>
  );
}
