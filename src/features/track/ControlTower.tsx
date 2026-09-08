import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { num } from "../../domain/format";
import { NetworkMap } from "../../map/NetworkMap";
import { navigate } from "../../app/router";
import { TripDetail } from "../trip/TripDetail";
import { cx } from "../../lib/cx";
import { useSim } from "../../store/simStore";
import { Badge, EmptyState, Panel, PanelBody, PanelHeader, Tooltip } from "../../ui";
import { useAnnouncer } from "../../a11y/Announcer";
import { ErrorBoundary } from "../../ui/ErrorBoundary";
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

export function ControlTower({ tripId }: { tripId?: string } = {}) {
  const { trips, states, kpis, history, queue, now, tickMs } = useSim();

  const [board, setBoard] = useState(() => loadBoard());
  const [views, setViews] = useState<SavedView[]>(() => loadViews());

  // Selection lives in the URL, so /track/TRP-88214 opens the drawer cold and
  // a controller can paste a trip at somebody rather than describing it.
  const selectedId = tripId ?? null;
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

  const selectedTrip = selectedId ? (trips.find((t) => t.id === selectedId) ?? null) : null;
  const selectedState = selectedTrip ? (states.get(selectedTrip.id) ?? null) : null;

  const criticalCount = visibleQueue.reduce(
    (n, q) => (q.exception.severity === "critical" ? n + 1 : n),
    0,
  );

  const toggleSelected = useCallback(
    (id: string | null) => {
      navigate(id === null || id === selectedId ? "/track" : `/track/${id}`);
    },
    [selectedId],
  );

  /* ------------------------------------------------------- announcements */

  const { announce } = useAnnouncer();
  const announcedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = visibleQueue.filter(
      (q) => q.exception.severity === "critical" && !announcedRef.current.has(q.exception.id),
    );
    // Only the arrival is news. Announcing the standing count on every tick
    // would make the region unusable.
    if (fresh.length > 0) {
      for (const q of fresh) announcedRef.current.add(q.exception.id);
      const first = fresh[0];
      announce(
        fresh.length === 1
          ? `Critical: ${first.exception.detail}, on ${first.trip.docs.lrNo}`
          : `${fresh.length} new critical exceptions, including ${first.exception.detail} on ${first.trip.docs.lrNo}`,
      );
    }
    // Forget anything that has closed, so a re-raise is announced again.
    const open = new Set(visibleQueue.map((q) => q.exception.id));
    for (const id of announcedRef.current) if (!open.has(id)) announcedRef.current.delete(id);
  }, [visibleQueue, announce]);

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

        {/* Below 1280 the panes stack and scroll, with the map reduced to a
            summary band — the table is the surface that still works on a tablet. */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto xl:grid-cols-[1.9fr_1fr] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
          <Panel className="max-xl:h-[300px] max-xl:shrink-0">
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
              <ErrorBoundary label="The map">
              <NetworkMap
                trips={filtered}
                states={states}
                now={now}
                selectedId={selectedId}
                onSelect={toggleSelected}
              />
              </ErrorBoundary>
            </PanelBody>
          </Panel>

          <Panel className="max-xl:h-[380px] max-xl:shrink-0">
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
                <ErrorBoundary label="The exception queue">
                  <ExceptionQueue
                    items={visibleQueue}
                    now={now}
                    selectedId={selectedId}
                    onSelect={toggleSelected}
                  />
                </ErrorBoundary>
              )}
            </PanelBody>
          </Panel>
        </div>

        {/* drag handle */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the trips table"
          /* A focusable separator is a widget, so it has to report its value.
             Without these axe flags it critical, and a screen reader has no
             idea what the arrow keys are changing. */
          aria-valuenow={Math.round(tableHeight)}
          aria-valuemin={MIN_TABLE_H}
          aria-valuemax={MAX_TABLE_H}
          aria-valuetext={`Trips table ${Math.round(tableHeight)} pixels tall`}
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
            <ErrorBoundary label="The trips table">
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
            </ErrorBoundary>
          </PanelBody>
        </Panel>
      </div>

      <TripDetail
        trip={selectedTrip}
        state={selectedState}
        now={now}
        onClose={() => navigate("/track")}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        trips={trips}
        views={views}
        onFilter={setFilter}
        onSelect={(id) => navigate(`/track/${id}`)}
      />
    </div>
  );
}

export { DEFAULT_BOARD };
