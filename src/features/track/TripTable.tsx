import { useEffect, useMemo, type ReactNode } from "react";
import { age, duration, istDateTime } from "../../domain/format";
import { openCount, worstOpen } from "../../domain/kpis";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { transporterName } from "../../domain/transporters";
import type { Trip, TripState } from "../../domain/types";
import { cx } from "../../lib/cx";
import { Chip, StatusPill } from "../../ui";
import type { Sort, SortKey } from "./filters";
import { STATUS_LABEL, STATUS_TONE } from "./present";
import { useCssPx, useVirtualRows } from "./useVirtualRows";

/* The full fleet, windowed.

   Only the rows inside the viewport are mounted — 1,200 rows of eleven cells
   is roughly 13,000 nodes, which React will mount happily and then scroll like
   treacle. The scrollbar is kept honest by two spacer rows.

   Row height comes from the density token rather than a constant, so the
   compact toggle moves the window with it. */

const SEVERITY_TONE = {
  critical: "crit",
  high: "warn",
  medium: "info",
  low: "neutral",
} as const;

export interface Column {
  key: string;
  label: string;
  width: number;
  align?: "right";
  sortKey?: SortKey;
  mono?: boolean;
  muted?: boolean;
  render: (t: Trip, s: TripState, now: number) => ReactNode;
}

export const COLUMNS: Column[] = [
  { key: "lr", label: "LR no.", width: 124, sortKey: "lr", mono: true,
    render: (t) => t.docs.lrNo },
  { key: "lane", label: "Lane", width: 210, sortKey: "lane",
    render: (t) => laneLabel(LANE_BY_ID.get(t.laneId)!) },
  { key: "transporter", label: "Transporter", width: 150, sortKey: "transporter",
    render: (t) => transporterName(t.transporterCode) },
  { key: "vehicle", label: "Vehicle", width: 132, mono: true,
    render: (t) => t.vehicle.regNo },
  { key: "progress", label: "Done", width: 66, align: "right", sortKey: "progress", mono: true, muted: true,
    render: (_t, s) => (s.status === "planned" ? "—" : `${Math.round(s.progress * 100)}%`) },
  { key: "speed", label: "km/h", width: 66, align: "right", sortKey: "speed", mono: true, muted: true,
    render: (_t, s) => (s.speedKmph > 0.5 ? Math.round(s.speedKmph) : "—") },
  { key: "status", label: "Status", width: 116, sortKey: "status",
    render: (_t, s) => (
      <StatusPill tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</StatusPill>
    ) },
  { key: "exception", label: "Exception", width: 104,
    render: (_t, s) => {
      const worst = worstOpen(s.exceptions);
      if (!worst) return <span className="text-ink-faint">—</span>;
      const open = openCount(s.exceptions);
      return (
        <span className="inline-flex items-center gap-1">
          <Chip tone={SEVERITY_TONE[worst.severity]} mono>{worst.code}</Chip>
          {open > 1 && (
            <span className="text-[11px] tabular-nums text-ink-faint">+{open - 1}</span>
          )}
        </span>
      );
    } },
  { key: "eta", label: "ETA", width: 116, sortKey: "eta", mono: true,
    render: (_t, s) => istDateTime(s.etaAt) },
  { key: "delay", label: "Delay", width: 82, align: "right", sortKey: "delay", mono: true,
    render: (_t, s) =>
      s.delayHours > 0 ? (
        // Colour goes on the value, not the cell: two colour utilities on one
        // element resolve by stylesheet order, not the order they are written.
        <span className="text-warn">{duration(s.delayHours)}</span>
      ) : (
        "—"
      ) },
  { key: "ping", label: "Last ping", width: 82, align: "right", sortKey: "ping", mono: true, muted: true,
    render: (_t, s, now) =>
      s.status === "delivered" || s.status === "planned" ? "—" : age(s.lastPingAt, now) },
];

export function TripTable({
  trips,
  states,
  now,
  sort,
  onSort,
  hiddenColumns,
  selectedId = null,
  onSelect,
}: {
  trips: readonly Trip[];
  states: ReadonlyMap<string, TripState>;
  now: number;
  sort: Sort | null;
  onSort: (key: SortKey) => void;
  hiddenColumns: readonly string[];
  selectedId?: string | null;
  onSelect?: (tripId: string) => void;
}) {
  const rowHeight = useCssPx("--row-h", 38);
  const columns = useMemo(
    () => COLUMNS.filter((c) => !hiddenColumns.includes(c.key)),
    [hiddenColumns],
  );

  const { scrollRef, window: win } = useVirtualRows({
    count: trips.length,
    rowHeight,
  });

  // Selecting on the map should bring the row into view, not leave the user
  // hunting for a highlight 900 rows down.
  useEffect(() => {
    if (!selectedId) return;
    const index = trips.findIndex((t) => t.id === selectedId);
    const el = scrollRef.current;
    if (index < 0 || !el) return;

    const top = index * rowHeight;
    if (top < el.scrollTop || top + rowHeight > el.scrollTop + el.clientHeight) {
      el.scrollTo({ top: Math.max(0, top - el.clientHeight / 2) });
    }
  }, [selectedId, trips, rowHeight, scrollRef]);

  const visible = trips.slice(win.start, win.end);

  return (
    <div ref={scrollRef} className="h-full min-h-0 w-full overflow-auto">
      <table
        aria-label="Trips"
        aria-rowcount={trips.length}
        className="w-full border-collapse text-left"
        style={{
          fontSize: "var(--data-size)",
          lineHeight: "var(--data-lh)",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>

        <thead className="sticky top-0 z-10 bg-sunken">
          <tr>
            {columns.map((c) => {
              // Both sides can be undefined on a non-sortable column, so the
              // null checks are load-bearing rather than defensive.
              const sorted =
                sort && c.sortKey && sort.key === c.sortKey ? sort.direction : null;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                  }
                  style={{ paddingInline: "var(--row-px)" }}
                  className={cx(
                    "h-8 border-b border-line text-[10.5px] font-medium tracking-[0.09em] whitespace-nowrap text-ink-mute uppercase",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.sortKey ? (
                    <button
                      type="button"
                      onClick={() => c.sortKey && onSort(c.sortKey)}
                      className={cx(
                        "inline-flex items-center gap-1 uppercase transition-colors hover:text-ink",
                        sorted && "text-accent",
                      )}
                    >
                      {c.label}
                      <span aria-hidden="true" className="text-[9px] leading-none">
                        {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "△"}
                      </span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {win.padTop > 0 && (
            <tr aria-hidden="true" style={{ height: win.padTop }}>
              <td colSpan={columns.length} />
            </tr>
          )}

          {visible.map((t, i) => {
            const s = states.get(t.id);
            if (!s) return null;
            const isSelected = t.id === selectedId;

            return (
              <tr
                key={t.id}
                aria-rowindex={win.start + i + 1}
                aria-selected={isSelected}
                tabIndex={0}
                onClick={onSelect ? () => onSelect(t.id) : undefined}
                onKeyDown={
                  onSelect
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(t.id);
                        }
                      }
                    : undefined
                }
                style={{ height: rowHeight }}
                className={cx(
                  "border-b border-line-soft",
                  onSelect && "cursor-pointer",
                  isSelected ? "bg-accent-soft" : "hover:bg-hover",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ paddingInline: "var(--row-px)" }}
                    className={cx(
                      "truncate",
                      c.align === "right" && "text-right",
                      c.mono && "font-mono text-[0.92em] tabular-nums",
                      c.muted ? "text-ink-mute" : "text-ink-soft",
                    )}
                  >
                    {c.render(t, s, now)}
                  </td>
                ))}
              </tr>
            );
          })}

          {win.padBottom > 0 && (
            <tr aria-hidden="true" style={{ height: win.padBottom }}>
              <td colSpan={columns.length} />
            </tr>
          )}

          {trips.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-[12.5px] text-ink-mute"
              >
                No trip matches this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
