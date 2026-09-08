import { duration, num, pct } from "../../domain/format";
import type { Kpis } from "../../domain/kpis";
import { cx } from "../../lib/cx";
import type { KpiSample } from "../../store/simStore";
import { Sparkline } from "./Sparkline";
import type { TripFilter } from "./filters";

/* Summary above detail, and every tile is a way in: clicking one narrows the
   whole board to what it counts. The delta is against the same figure 24
   simulated hours ago, which is the comparison a shift lead actually makes. */

type Direction = "up-good" | "up-bad" | "neutral";

interface Tile {
  key: string;
  label: string;
  value: string;
  /** Raw series for the sparkline. */
  series: (s: KpiSample) => number;
  current: number;
  unit?: string;
  direction: Direction;
  tone: "accent" | "ok" | "warn" | "crit";
  /** How this tile narrows the board, or null when it is not a filter. */
  filter: Partial<TripFilter> | null;
}

function buildTiles(k: Kpis): Tile[] {
  return [
    {
      key: "inTransit",
      label: "In transit",
      value: num(k.inTransit),
      unit: "trips",
      series: (s) => s.inTransit,
      current: k.inTransit,
      direction: "neutral",
      tone: "accent",
      filter: { statuses: ["in_transit", "at_risk"] },
    },
    {
      key: "onTime",
      label: "On-time delivery",
      value: pct(k.onTimePct),
      series: (s) => s.onTimePct,
      current: k.onTimePct,
      direction: "up-good",
      tone: "ok",
      filter: { statuses: ["delivered"] },
    },
    {
      key: "atRisk",
      label: "At risk",
      value: num(k.atRisk),
      series: (s) => s.atRisk,
      current: k.atRisk,
      direction: "up-bad",
      tone: "warn",
      filter: { statuses: ["at_risk"] },
    },
    {
      key: "delivered",
      label: "Delivered today",
      value: num(k.deliveredToday),
      series: (s) => s.deliveredToday,
      current: k.deliveredToday,
      direction: "up-good",
      tone: "ok",
      filter: { statuses: ["delivered"] },
    },
    {
      key: "avgDelay",
      label: "Avg delay",
      value: duration(k.avgDelayH),
      series: (s) => s.avgDelayH,
      current: k.avgDelayH,
      direction: "up-bad",
      tone: "warn",
      filter: { severities: ["high", "critical"] },
    },
    {
      key: "visibility",
      label: "Visibility",
      value: pct(k.visibilityPct),
      series: (s) => s.visibilityPct,
      current: k.visibilityPct,
      direction: "up-good",
      tone: "accent",
      filter: { codes: ["EX-03"] },
    },
  ];
}

function Delta({
  current,
  previous,
  direction,
  isPercent,
}: {
  current: number;
  previous: number | null;
  direction: Direction;
  isPercent: boolean;
}) {
  if (previous === null || !Number.isFinite(previous)) return null;

  const change = current - previous;
  if (Math.abs(change) < (isPercent ? 0.05 : 0.5)) {
    return <span className="text-[11px] text-ink-faint tabular-nums">±0</span>;
  }

  const better =
    direction === "neutral"
      ? null
      : direction === "up-good"
        ? change > 0
        : change < 0;

  const text = `${change > 0 ? "+" : "−"}${
    isPercent ? Math.abs(change).toFixed(1) : num(Math.round(Math.abs(change)))
  }`;

  return (
    <span
      className={cx(
        "text-[11px] tabular-nums",
        better === null ? "text-ink-mute" : better ? "text-ok" : "text-crit",
      )}
      title="Against the same figure 24 simulated hours ago"
    >
      {text}
    </span>
  );
}

export function KpiStrip({
  kpis,
  history,
  activeKey,
  onPick,
}: {
  kpis: Kpis;
  history: readonly KpiSample[];
  activeKey: string | null;
  onPick: (key: string, filter: Partial<TripFilter> | null) => void;
}) {
  const tiles = buildTiles(kpis);
  const oldest = history.length ? history[0] : null;

  return (
    <div
      className="grid shrink-0 grid-cols-2 divide-line-soft overflow-hidden rounded-md border border-line bg-panel sm:grid-cols-3 sm:divide-x lg:grid-cols-6"
      role="group"
      aria-label="Network summary"
    >
      {tiles.map((t) => {
        const series = history.map(t.series);
        const isActive = activeKey === t.key;
        const isPercent = t.value.includes("%");

        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onPick(t.key, t.filter)}
            className={cx(
              "px-4 py-3 text-left transition-colors",
              isActive ? "bg-accent-soft" : "hover:bg-hover",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
                {t.label}
              </span>
              <Delta
                current={t.current}
                previous={oldest ? t.series(oldest) : null}
                direction={t.direction}
                isPercent={isPercent}
              />
            </div>

            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="flex items-baseline gap-1.5">
                <span className="text-[22px] leading-none font-semibold tabular-nums text-ink">
                  {t.value}
                </span>
                {t.unit && <span className="text-[12px] text-ink-mute">{t.unit}</span>}
              </span>
              <Sparkline values={series} tone={t.tone} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
