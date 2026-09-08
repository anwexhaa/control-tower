import { useCallback, useState } from "react";
import { num } from "../../domain/format";
import { NetworkMap } from "../../map/NetworkMap";
import { useSim } from "../../store/simStore";
import { Badge, EmptyState, Panel, PanelBody, PanelHeader, Tooltip } from "../../ui";
import { ExceptionQueue } from "./ExceptionQueue";
import { KpiStrip } from "./KpiStrip";
import { TripTable } from "./TripTable";

const TABLE_PREVIEW_ROWS = 150;

export function ControlTower() {
  const { trips, states, kpis, queue, now, tickMs } = useSim();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleSelected = useCallback(
    (id: string | null) => setSelectedId((current) => (current === id ? null : id)),
    [],
  );

  const criticalCount = queue.reduce(
    (n, q) => (q.exception.severity === "critical" ? n + 1 : n),
    0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <KpiStrip kpis={kpis} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.9fr_1fr]">
        <Panel>
          <PanelHeader
            title="Live network"
            subtitle="India · all corridors"
            actions={
              <Tooltip
                label={`Simulation step across ${num(trips.length)} trips`}
                side="bottom"
              >
                <span className="font-mono text-[10.5px] text-ink-faint tabular-nums">
                  {tickMs.toFixed(1)} ms
                </span>
              </Tooltip>
            }
          />
          <PanelBody scroll={false} padded={false}>
            <NetworkMap
              trips={trips}
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
            subtitle={`${num(queue.length)} open · worst first`}
            actions={criticalCount > 0 ? <Badge tone="crit">{criticalCount}</Badge> : null}
          />
          <PanelBody scroll padded={false}>
            {queue.length === 0 ? (
              <EmptyState
                title="Nothing open"
                description="No exception is currently raised against any trip on the board."
              />
            ) : (
              <ExceptionQueue
                items={queue}
                now={now}
                selectedId={selectedId}
                onSelect={toggleSelected}
              />
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel className="h-[38%] min-h-[220px] shrink-0">
        <PanelHeader
          title="Trips"
          subtitle={`Showing ${num(Math.min(TABLE_PREVIEW_ROWS, trips.length))} of ${num(trips.length)} · virtualisation in phase 4`}
        />
        <PanelBody scroll={false} padded={false}>
          <TripTable
            trips={trips}
            states={states}
            now={now}
            limit={TABLE_PREVIEW_ROWS}
            selectedId={selectedId}
            onSelect={toggleSelected}
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
