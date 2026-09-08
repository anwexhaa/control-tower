import { Chip, EmptyState, Metric, Panel, PanelBody, PanelHeader, Skeleton } from "../../ui";
import { IconColumns, IconFilter, IconLayers, IconTrack } from "../../ui/icons";

/* Phase 0 stands the control tower layout up with the regions in their final
   positions and each one labelled with the phase that fills it. The geometry
   is real — phases 3 and 4 replace the contents, not the frame. */

function Pending({
  phase,
  title,
  description,
  icon,
}: {
  phase: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center">
      <div>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          action={<Chip tone="info" mono>{phase}</Chip>}
        />
      </div>
    </div>
  );
}

const KPIS = [
  { label: "In transit", value: "—", unit: "trips" },
  { label: "On-time delivery", value: "—", unit: "%" },
  { label: "At risk", value: "—", unit: "" },
  { label: "Delivered today", value: "—", unit: "" },
  { label: "Avg delay", value: "—", unit: "h" },
  { label: "Visibility", value: "—", unit: "%" },
];

export function ControlTowerScaffold() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      {/* KPI strip */}
      <Panel className="shrink-0">
        <div className="grid grid-cols-2 divide-line-soft sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
          {KPIS.map((k) => (
            <div key={k.label} className="px-4 py-3">
              <Metric label={k.label} value={k.value} unit={k.unit} />
              <Skeleton className="mt-2 h-4 w-full opacity-60" />
            </div>
          ))}
        </div>
      </Panel>

      {/* map + exception queue */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.9fr_1fr]">
        <Panel>
          <PanelHeader
            title="Live network"
            subtitle="India · all corridors"
            actions={
              <>
                <span className="text-ink-faint">
                  <IconLayers size={15} />
                </span>
                <span className="text-ink-faint">
                  <IconFilter size={15} />
                </span>
              </>
            }
          />
          <PanelBody scroll={false} className="grid place-items-center">
            <Pending
              phase="Phase 03"
              icon={<IconTrack size={26} />}
              title="India map renderer"
              description="Real state boundaries on an SVG layer, 1,200 live vehicles drawn on canvas above it, with a hand-written Mercator projection and a quadtree for hit-testing."
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Exception queue" subtitle="Severity ordered" />
          <PanelBody scroll={false}>
            <Pending
              phase="Phase 04"
              title="Triage queue"
              description="Open exceptions ranked by severity with acknowledge, assign, snooze and resolve, and ageing timers that escalate on their own."
            />
          </PanelBody>
        </Panel>
      </div>

      {/* trip table */}
      <Panel className="h-[38%] min-h-[220px] shrink-0">
        <PanelHeader
          title="Trips"
          subtitle="Virtualised · all statuses"
          actions={
            <span className="text-ink-faint">
              <IconColumns size={15} />
            </span>
          }
        />
        <PanelBody scroll={false}>
          <Pending
            phase="Phase 04"
            title="Virtualised trip table"
            description="Every trip in the network with LR number, lane, transporter, vehicle, ETA and delay — sortable and filterable, holding 60 fps across 1,200 rows."
          />
        </PanelBody>
      </Panel>
    </div>
  );
}
