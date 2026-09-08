import { useMemo, useState } from "react";
import { duration, num, pct } from "../../domain/format";
import { cx } from "../../lib/cx";
import { ON_TIME_TARGET_PCT, type TransporterRow } from "./aggregate";

/* Carrier performance, measured against what they are contracted to hold.

   The delta is the column that matters: an 84% carrier contracted at 80% is
   doing better than a 90% carrier contracted at 96%, and a scorecard that only
   ranks on the raw figure hides that. */

type SortKey = "name" | "trips" | "onTimePct" | "deltaPct" | "avgDelayH" | "detentionH" | "exceptionsPerTrip";

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right"; width?: string }> = [
  { key: "name", label: "Transporter" },
  { key: "trips", label: "Trips", align: "right", width: "w-[58px]" },
  { key: "onTimePct", label: "On time", width: "w-[150px]" },
  { key: "deltaPct", label: "vs contract", align: "right", width: "w-[86px]" },
  { key: "avgDelayH", label: "Avg delay", align: "right", width: "w-[80px]" },
  { key: "detentionH", label: "Detention", align: "right", width: "w-[80px]" },
  { key: "exceptionsPerTrip", label: "Exc / trip", align: "right", width: "w-[76px]" },
];

export function Scorecard({ rows }: { rows: TransporterRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "deltaPct",
    dir: "asc",
  });

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      // Carriers with nothing delivered sink rather than ranking first.
      const na = va === null ? Number.POSITIVE_INFINITY : va;
      const nb = vb === null ? Number.POSITIVE_INFINITY : vb;
      return (na - nb) * dir;
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sort.key === c.key
                    ? sort.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={cx(
                  "pb-1.5 text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase",
                  c.align === "right" && "text-right",
                  c.width,
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className={cx(
                    "inline-flex items-center gap-1 uppercase transition-colors hover:text-ink",
                    sort.key === c.key && "text-accent",
                  )}
                >
                  {c.label}
                  <span aria-hidden="true" className="text-[8px]">
                    {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "△"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const below = r.onTimePct !== null && r.onTimePct < ON_TIME_TARGET_PCT;
            return (
              <tr key={r.code} className="border-b border-line-soft last:border-0">
                <td className="py-1.5 pr-2 text-[12px] text-ink-soft">{r.name}</td>

                <td className="py-1.5 pr-2 text-right font-mono text-[11px] tabular-nums text-ink-faint">
                  {r.trips}
                </td>

                <td className="py-1.5 pr-3">
                  {r.onTimePct === null ? (
                    <span className="text-[11px] text-ink-faint">nothing landed yet</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative h-2.5 min-w-0 flex-1 rounded-xs bg-sunken">
                        <div
                          className={cx("h-full rounded-xs", below ? "bg-warn" : "bg-ok")}
                          style={{ width: `${Math.max(2, r.onTimePct)}%` }}
                        />
                        {/* where the target sits, so the bar is readable alone */}
                        <span
                          aria-hidden="true"
                          className="absolute top-[-2px] bottom-[-2px] w-px bg-ink-mute"
                          style={{ left: `${ON_TIME_TARGET_PCT}%` }}
                        />
                      </div>
                      <span className="w-[42px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink">
                        {pct(r.onTimePct, 0)}
                      </span>
                    </div>
                  )}
                </td>

                <td className="py-1.5 pr-2 text-right font-mono text-[11px] tabular-nums">
                  {r.deltaPct === null ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <span className={r.deltaPct >= 0 ? "text-ok" : "text-crit"}>
                      {r.deltaPct >= 0 ? "+" : "−"}
                      {Math.abs(r.deltaPct).toFixed(1)}
                    </span>
                  )}
                </td>

                <td className="py-1.5 pr-2 text-right font-mono text-[11px] tabular-nums text-ink-soft">
                  {r.avgDelayH > 0 ? duration(r.avgDelayH) : "—"}
                </td>

                <td className="py-1.5 pr-2 text-right font-mono text-[11px] tabular-nums text-ink-soft">
                  {r.detentionH > 0.5 ? duration(r.detentionH) : "—"}
                </td>

                <td className="py-1.5 text-right font-mono text-[11px] tabular-nums text-ink-mute">
                  {r.exceptionsPerTrip.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2 text-[10.5px] text-ink-faint">
        {num(sorted.length)} carriers on the board. The marker on each bar is the{" "}
        {ON_TIME_TARGET_PCT}% network target; “vs contract” is measured on-time against
        the figure that carrier is contracted to hold.
      </p>
    </div>
  );
}
