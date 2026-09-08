import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { num } from "../../domain/format";
import { NetworkMap } from "../../map/NetworkMap";
import { cx } from "../../lib/cx";
import { useSim } from "../../store/simStore";
import { Badge, EmptyState, Panel, PanelBody, PanelHeader, Tooltip } from "../../ui";
import { CommandPalette } from "./CommandPalette";
import { ExceptionQueue } from "./ExceptionQueue";
import { FilterBar } from "./FilterBar";
import { KpiStrip } from "./KpiStrip";
import { OPEN_PALETTE, openPalette } from "./paletteBus";
import { TripTable } from "./TripTable";
import {
  applyFilter,
  EMPTY_FILTER,
  isFilterActive,
  sortTrips,
  type Sort,
  type SortKey,
  type TripFilter,
} from "./filters";
import {
  DEFAULT_BOARD,
  loadBoard,
  loadViews,
  persistBoard,
  persistViews,
  type SavedView,
} from "./savedViews";

const MIN_TABLE_H = 140;
const MAX_TABLE_H = 720;

export function ControlTower() {
  const { trips, states, kpis, history, queue, now, tickMs } = useSim();

  const [board, setBoard] = useState(() => loadBoard());
  const [views, setViews] = useState<SavedView[]>(() => loadViews());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { filter, sort, hiddenColumns, tableHeight } = board;

  /* ------------------------------------------------------------ persistence */

  useEffect(() => persistBoard(board), [board]);
  useEffect(() => persistViews(views), [views]);

  const setFilter = useCallback((next: TripFilter) => {
    setBoard((b) => ({ ...b, filter: next }));
    if (!isFilterActive(next)) setActiveTile(null);
  }, []);

  const setHiddenColumns = useCallback((next: string[]) => {
    setBoard((b) => ({ ...b, hiddenColumns: next }));
  }, []);

  const onSort = useCallback((key: SortKey) => {
    setBoard((b) => {
      const current = b.sort;
      const next: Sort =
        current?.key !== key
          ? { key, direction: "asc" }
          : current.direction === "asc"
            ? { key, direction: "desc" }
            : { key, direction: "asc" };
      return { ...b, sort: next };
    });
  }, []);

  /* ----------------------------------------------------------------- derive */

  const filtered = useMemo(
    () => applyFilter(trips, states, filter),
    [trips, states, filter],
  );

  const rows = useMemo(() => sortTrips(filtered, states, sort), [filtered, states, sort]);

  /** The queue narrows with the board, so the four panes never disagree. */
  const visibleQueue = useMemo(() => {
    if (!isFilterActive(filter)) return queue;
    const allowed = new Set(filtered.map((t) => t.id));
    return queue.filter((q) => allowed.has(q.trip.id));
  }, [queue, filtered, filter]);

  const criticalCount = visibleQueue.reduce(
    (n, q) => (q.exception.severity === "critical" ? n + 1 : n),
    0,
  );

  const toggleSelected = useCallback(
    (id: string | null) => setSelectedId((current) => (current === id ? null : id)),
    [],
  );

  /* ----------------------------------------------------------- command menu */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    const onOpen = () => setPaletteOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE, onOpen);
    };
  }, []);

  /* -------------------------------------------------------------- resizing */

  const resizing = useRef<{ startY: number; startH: number } | null>(null);

  const onResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      resizing.current = { startY: e.clientY, startH: tableHeight };
    },
    [tableHeight],
  );

  const onResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing.current) return;
    const delta = resizing.current.startY - e.clientY;
    const next = Math.max(
      MIN_TABLE_H,
      Math.min(MAX_TABLE_H, resizing.current.startH + delta),
    );
    setBoard((b) => ({ ...b, tableHeight: next }));
  }, []);

  const onResizeUp = useCallback(() => {
    resizing.current = null;
  }, []);

  /* -------------------------------------------------------------------- ui */

  return (
    <div className="flex h-full min-h-0 flex-col">
      <FilterBar
        filter={filter}
        onFilter={setFilter}
        shown={filtered.length}
        total={trips.length}
        hiddenColumns={hiddenColumns}
        onHiddenColumns={setHiddenColumns}
        views={views}
        onViews={setViews}
        onOpenPalette={openPalette}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <KpiStrip
          kpis={kpis}
          history={history}
          activeKey={activeTile}
          onPick={(key, patch) => {
            if (activeTile === key) {
              setActiveTile(null);
              setFilter(EMPTY_FILTER);
              return;
            }
            setActiveTile(key);
            setBoard((b) => ({ ...b, filter: { ...EMPTY_FILTER, ...patch } }));
          }}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.9fr_1fr]">
          <Panel>
            <PanelHeader
              title="Live network"
              subtitle={
                isFilterActive(filter)
                  ? `${num(filtered.length)} of ${num(trips.length)} shown`
                  : "India · all corridors"
              }
              actions={
                <Tooltip
                  label={`Simulation step across ${num(trips.length)} trips`}
                  side="bottom"
                >
                  <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                    {tickMs.toFixed(1)} ms
                  </span>
                </Tooltip>
              }
            />
            <PanelBody scroll={false} padded={false}>
              <NetworkMap
                trips={filtered}
                states={states}
                now={now}
                selectedId={selectedId}
                onSelect={toggleSelected}
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Exception queue"
              subtitle={`${num(visibleQueue.length)} open · worst first`}
              actions={criticalCount > 0 ? <Badge tone="crit">{criticalCount}</Badge> : null}
            />
            <PanelBody scroll padded={false}>
              {visibleQueue.length === 0 ? (
                <EmptyState
                  title={isFilterActive(filter) ? "Nothing open in this view" : "Nothing open"}
                  description={
                    isFilterActive(filter)
                      ? "No exception is raised against the trips this filter selects. Widen it or clear it to see the whole network."
                      : "No exception is currently raised against any trip on the board."
                  }
                />
              ) : (
                <ExceptionQueue
                  items={visibleQueue}
                  now={now}
                  selectedId={selectedId}
                  onSelect={toggleSelected}
                />
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* drag handle */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the trips table"
          tabIndex={0}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const delta = e.key === "ArrowUp" ? 24 : -24;
              setBoard((b) => ({
                ...b,
                tableHeight: Math.max(
                  MIN_TABLE_H,
                  Math.min(MAX_TABLE_H, b.tableHeight + delta),
                ),
              }));
            }
          }}
          className={cx(
            "group/handle -my-1.5 flex h-3 shrink-0 cursor-row-resize items-center justify-center",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          )}
        >
          <span className="h-px w-16 rounded-full bg-line-strong transition-colors group-hover/handle:bg-accent" />
        </div>

        <Panel style={{ height: tableHeight }} className="shrink-0">
          <PanelHeader
            title="Trips"
            subtitle={
              isFilterActive(filter)
                ? `${num(rows.length)} matching · virtualised`
                : `${num(rows.length)} · virtualised`
            }
          />
          <PanelBody scroll={false} padded={false}>
            <TripTable
              trips={rows}
              states={states}
              now={now}
              sort={sort}
              onSort={onSort}
              hiddenColumns={hiddenColumns}
              selectedId={selectedId}
              onSelect={toggleSelected}
            />
          </PanelBody>
        </Panel>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        trips={trips}
        views={views}
        onFilter={setFilter}
        onSelect={(id) => setSelectedId(id)}
      />
    </div>
  );
}

export { DEFAULT_BOARD };
