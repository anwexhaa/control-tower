import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EXCEPTION_DEFS, EXCEPTION_CODES } from "../../domain/exceptions";
import { LANE_BY_ID, LANES, laneLabel } from "../../domain/lanes";
import { TRANSPORTERS } from "../../domain/transporters";
import type { Trip } from "../../domain/types";
import { cx } from "../../lib/cx";
import { KeyHint } from "../../ui";
import { EMPTY_FILTER, type TripFilter } from "./filters";
import type { SavedView } from "./savedViews";

/* Cmd-K. Jump to a trip by LR or registration, pivot the board onto one
   transporter, corridor or exception code, or recall a saved view.

   Everything is one substring pass over pre-joined strings — 1,200 trips is
   not enough to justify a search index, and a fuzzy matcher would make
   "MH-04" match things it should not. */

const MAX_PER_GROUP = 6;

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  trips,
  views,
  onFilter,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  trips: readonly Trip[];
  views: SavedView[];
  onFilter: (f: TripFilter) => void;
  onSelect: (tripId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Layout effect, not rAF: the input must take focus the moment the palette
  // mounts. A rAF callback never runs in a backgrounded tab, which leaves the
  // palette open and swallowing keystrokes.
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    inputRef.current?.focus();
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Command[] = [];

    const push = (group: string, items: Command[]) => {
      for (const item of items.slice(0, MAX_PER_GROUP)) out.push({ ...item, group });
    };

    if (views.length) {
      push(
        "Views",
        views
          .filter((v) => !q || v.name.toLowerCase().includes(q))
          .map((v) => ({
            id: `view:${v.id}`,
            group: "Views",
            label: v.name,
            hint: "saved view",
            run: () => onFilter(v.filter),
          })),
      );
    }

    if (q) {
      push(
        "Trips",
        trips
          .filter(
            (t) =>
              t.docs.lrNo.toLowerCase().includes(q) ||
              t.vehicle.regNo.toLowerCase().includes(q),
          )
          .map((t) => ({
            id: `trip:${t.id}`,
            group: "Trips",
            label: `${t.docs.lrNo} · ${t.vehicle.regNo}`,
            hint: laneLabel(LANE_BY_ID.get(t.laneId)!),
            run: () => onSelect(t.id),
          })),
      );
    }

    push(
      "Transporters",
      TRANSPORTERS.filter((t) => !q || t.name.toLowerCase().includes(q)).map((t) => ({
        id: `tp:${t.code}`,
        group: "Transporters",
        label: t.name,
        hint: `${t.fleetSize} vehicles · ${t.onTimePct.toFixed(1)}% on time`,
        run: () => onFilter({ ...EMPTY_FILTER, transporterCodes: [t.code] }),
      })),
    );

    push(
      "Corridors",
      LANES.filter((l) => !q || laneLabel(l).toLowerCase().includes(q)).map((l) => ({
        id: `lane:${l.id}`,
        group: "Corridors",
        label: laneLabel(l),
        hint: `${l.distanceKm} km · ${l.transitHours}h`,
        run: () => onFilter({ ...EMPTY_FILTER, laneIds: [l.id] }),
      })),
    );

    push(
      "Exceptions",
      EXCEPTION_CODES.filter(
        (c) =>
          !q ||
          c.toLowerCase().includes(q) ||
          EXCEPTION_DEFS[c].label.toLowerCase().includes(q),
      ).map((c) => ({
        id: `code:${c}`,
        group: "Exceptions",
        label: `${c} · ${EXCEPTION_DEFS[c].label}`,
        hint: EXCEPTION_DEFS[c].trigger,
        run: () => onFilter({ ...EMPTY_FILTER, codes: [c] }),
      })),
    );

    if (!q) {
      out.push({
        id: "clear",
        group: "Board",
        label: "Clear all filters",
        hint: "show the whole network",
        run: () => onFilter(EMPTY_FILTER),
      });
    }

    return out;
  }, [query, trips, views, onFilter, onSelect]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  if (!open) return null;

  const runAt = (index: number) => {
    const command = commands[index];
    if (!command) return;
    command.run();
    onClose();
  };

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative flex max-h-[60vh] w-[min(620px,92vw)] flex-col overflow-hidden rounded-md border border-line bg-panel shadow-lg"
      >
        <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") return onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, commands.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                runAt(cursor);
              }
            }}
            placeholder="Jump to an LR, vehicle, transporter, corridor or exception…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />
          <KeyHint keys="esc" />
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-auto py-1">
          {commands.length === 0 && (
            <p className="px-3 py-6 text-center text-[12.5px] text-ink-mute">
              Nothing matches “{query}”.
            </p>
          )}

          {commands.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;

            return (
              <div key={command.id}>
                {header && (
                  <div className="px-3 pt-2 pb-1 font-mono text-[9.5px] tracking-[0.11em] text-ink-faint uppercase">
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => runAt(index)}
                  className={cx(
                    "flex w-full items-baseline gap-2 px-3 py-1.5 text-left",
                    index === cursor ? "bg-accent-soft" : "hover:bg-hover",
                  )}
                >
                  <span
                    className={cx(
                      "truncate text-[13px]",
                      index === cursor ? "text-accent" : "text-ink",
                    )}
                  >
                    {command.label}
                  </span>
                  {command.hint && (
                    <span className="ml-auto shrink-0 truncate text-[11px] text-ink-faint">
                      {command.hint}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-line-soft bg-sunken px-3 py-1.5 text-[10.5px] text-ink-faint">
          <span className="flex items-center gap-1">
            <KeyHint keys="up" />
            <KeyHint keys="down" /> navigate
          </span>
          <span className="flex items-center gap-1">
            <KeyHint keys="enter" /> run
          </span>
        </div>
      </div>
    </div>
  );
}
