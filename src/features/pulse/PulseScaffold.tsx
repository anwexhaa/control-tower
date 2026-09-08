import { Chip, EmptyState, Panel, PanelBody, PanelHeader } from "../../ui";
import { IconPulse } from "../../ui/icons";

const SECTIONS = [
  {
    title: "Transporter scorecard",
    body: "On-time delivery, acceptance rate, average delay, detention hours and exception rate for every transporter in the network.",
  },
  {
    title: "Lane heat table",
    body: "Corridors down, weeks across, cells shaded by on-time performance with volume as a second encoding.",
  },
  {
    title: "Delay Pareto",
    body: "Root cause by exception code with a cumulative line — which two problems cause most of the misses.",
  },
  {
    title: "Cost per BTKM",
    body: "Freight cost per billed tonne-kilometre by lane, with detention cost layered on top.",
  },
];

export function PulseScaffold() {
  return (
    <div className="h-full overflow-auto p-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SECTIONS.map((s) => (
          <Panel key={s.title} className="min-h-[260px]">
            <PanelHeader title={s.title} />
            <PanelBody scroll={false} className="grid place-items-center">
              <EmptyState
                icon={<IconPulse size={24} />}
                title={s.title}
                description={s.body}
                action={
                  <Chip tone="info" mono>
                    Phase 06
                  </Chip>
                }
              />
            </PanelBody>
          </Panel>
        ))}
      </div>
    </div>
  );
}
