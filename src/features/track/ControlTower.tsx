import { useMemo } from "react";
import { buildQueue, computeKpis } from "../../domain/kpis";
import { num } from "../../domain/format";
import { getNetwork } from "../../store/network";
import { Badge, Chip, EmptyState, Panel, PanelBody, PanelHeader } from "../../ui";
import { IconTrack } from "../../ui/icons";
import { ExceptionQueue } from "./ExceptionQueue";
import { KpiStrip } from "./KpiStrip";
import { TripTable } from "./TripTable";

const TABLE_PREVIEW_ROWS = 150;

export function ControlTower() {
  const net = getNetwork();

  const kpis = useMemo(() => computeKpis(net.trips, net.now), [net]);
  const queue = useMemo(() => buildQueue(net.trips), [net]);

  const criticalCount = queue.filter((q) => q.exception.severity === "critical").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <KpiStrip kpis={kpis} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.9fr_1fr]">
        <Panel>
          <PanelHeader title="Live network" subtitle="India · all corridors" />
          <PanelBody scroll={false} className="grid place-items-center">
            <EmptyState
              icon={<IconTrack size={26} />}
              title="India map renderer"
              description="Real state boundaries on an SVG layer with the fleet drawn on canvas above it — a hand-written Mercator projection and a quadtree for hit-testing."
              action={
                <Chip tone="info" mono>
                  Phase 03
                </Chip>
              }
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
              <ExceptionQueue items={queue} now={net.now} />
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel className="h-[38%] min-h-[220px] shrink-0">
        <PanelHeader
          title="Trips"
          subtitle={`Showing ${num(Math.min(TABLE_PREVIEW_ROWS, net.trips.length))} of ${num(net.trips.length)} · virtualisation in phase 4`}
        />
        <PanelBody scroll={false} padded={false}>
          <TripTable trips={net.trips} now={net.now} limit={TABLE_PREVIEW_ROWS} />
        </PanelBody>
      </Panel>
    </div>
  );
}
