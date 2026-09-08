import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

/* The full fleet, windowed and keyboard-operable.

   Only the rows inside the viewport are mounted — 1,200 rows of eleven cells is
   roughly 13,000 nodes, which React will mount happily and then scroll like
   treacle. The scrollbar is kept honest by two spacer rows.

   Keyboard navigation uses a roving tabindex: exactly one row is tabbable, so
   Tab moves past the table rather than through 1,200 stops, and the arrows move
   within it. Because the target row may not be mounted, moving scrolls first
   and focuses once React has rendered it. */

const SEVERITY_TONE = {
  critical: "crit",
  high: "warn",
  medium: "info",
  low: "neutral",
} as const;

/** How long a type-ahead buffer stays alive between keystrokes. */
const TYPEAHEAD_MS = 900;

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

  /* --------------------------------------------------- roving focus state */

  const [activeIndex, setActiveIndex] = useState(0);
  /** Set when a keypress moved the cursor, so focus follows the render. */
  const wantFocus = useRef(false);
  const typeahead = useRef({ buffer: "", at: 0 });

  // Clamp when the filter shrinks the list under the cursor.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, trips.length - 1)));
  }, [trips.length]);

  const scrollIntoView = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const top = index * rowHeight;
      if (top < el.scrollTop) el.scrollTo({ top });
      else if (top + rowHeight > el.scrollTop + el.clientHeight) {
        el.scrollTo({ top: top - el.clientHeight + rowHeight });
      }
    },
    [rowHeight, scrollRef],
  );

  const moveTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(trips.length - 1, index));
      wantFocus.current = true;
      setActiveIndex(clamped);
      scrollIntoView(clamped);
    },
    [scrollIntoView, trips.length],
  );

  // The row may only have just been mounted by the scroll above, so focusing
  // waits for the render rather than happening in the key handler.
  useEffect(() => {
    if (!wantFocus.current) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${activeIndex}"]`,
    );
    if (el) {
      el.focus({ preventScroll: true });
      wantFocus.current = false;
    }
  }, [activeIndex, win.start, win.end, scrollRef]);

  // Selecting on the map brings the row into view rather than leaving the user
  // hunting for a highlight 900 rows down.
  useEffect(() => {
    if (!selectedId) return;
    const index = trips.findIndex((t) => t.id === selectedId);
    if (index >= 0) {
      setActiveIndex(index);
      scrollIntoView(index);
    }
  }, [selectedId, trips, scrollIntoView]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          return moveTo(activeIndex + 1);
        case "ArrowUp":
          e.preventDefault();
          return moveTo(activeIndex - 1);
        case "PageDown":
          e.preventDefault();
          return moveTo(activeIndex + 10);
        case "PageUp":
          e.preventDefault();
          return moveTo(activeIndex - 10);
        case "Home":
          e.preventDefault();
          return moveTo(0);
        case "End":
          e.preventDefault();
          return moveTo(trips.length - 1);
        case "Enter":
        case " ": {
          e.preventDefault();
          const trip = trips[activeIndex];
          if (trip && onSelect) onSelect(trip.id);
          return;
        }
      }

      // Type-ahead over the LR number and registration — the two things a
      // controller reads off a phone call.
      if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
      const nowMs = Date.now();
      const buffer =
        nowMs - typeahead.current.at > TYPEAHEAD_MS
          ? e.key.toLowerCase()
          : typeahead.current.buffer + e.key.toLowerCase();
      typeahead.current = { buffer, at: nowMs };

      const found = trips.findIndex(
        (t) =>
          t.docs.lrNo.toLowerCase().includes(buffer) ||
          t.vehicle.regNo.toLowerCase().includes(buffer),
      );
      if (found >= 0) {
        e.preventDefault();
        moveTo(found);
      }
    },
    [activeIndex, moveTo, onSelect, trips],
  );

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

        <tbody onKeyDown={onKeyDown}>
          {win.padTop > 0 && (
            <tr aria-hidden="true" style={{ height: win.padTop }}>
              <td colSpan={columns.length} />
            </tr>
          )}

          {visible.map((t, i) => {
            const s = states.get(t.id);
            if (!s) return null;
            const index = win.start + i;
            const isSelected = t.id === selectedId;

            return (
              <tr
                key={t.id}
                data-row-index={index}
                aria-rowindex={index + 1}
                aria-selected={isSelected}
                /* Roving: exactly one row is in the tab order. */
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onClick={onSelect ? () => onSelect(t.id) : undefined}
                style={{ height: rowHeight }}
                className={cx(
                  "border-b border-line-soft outline-offset-[-2px]",
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
