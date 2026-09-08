import { useMemo } from "react";
import { inrCompact, num, pct } from "../../domain/format";
import { useSim } from "../../store/simStore";
import { Panel, PanelBody, PanelHeader, Tooltip } from "../../ui";
import { CostView } from "./CostView";
import { DelayPareto } from "./DelayPareto";
import { LaneHeat } from "./LaneHeat";
import { Scorecard } from "./Scorecard";
import {
  costByLane,
  delayPareto,
  headline,
  laneHeat,
  transporterScorecard,
} from "./aggregate";

/* Pulse: the review a logistics head runs, off the same board the controllers
   are working. Every figure recomputes from live state on each tick — nothing
   is precomputed, so the two screens cannot drift apart. */

function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="truncate text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tabular-nums text-ink">
          {value}
        </span>
        {unit && <span className="text-[12px] text-ink-mute">{unit}</span>}
      </div>
      {note && <div className="mt-1 truncate text-[11px] text-ink-faint">{note}</div>}
    </div>
  );
}

export function Pulse() {
  const { trips, states, now } = useSim();

  const { data, computeMs } = useMemo(() => {
    const started = performance.now();
    const value = {
      head: headline(trips, states, now),
      carriers: transporterScorecard(trips, states),
      heat: laneHeat(trips, states, now),
      pareto: delayPareto(trips, states),
      cost: costByLane(trips, states),
    };
    return { data: value, computeMs: performance.now() - started };
  }, [trips, states, now]);

  const { head, carriers, heat, pareto, cost } = data;

  return (
    <div className="h-full overflow-auto p-3">
      <div className="flex flex-col gap-3">
        <Panel>
          <div className="grid grid-cols-2 divide-line-soft sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
            <Stat
              label="Delivered today"
              value={num(head.deliveredWindow)}
              note="since midnight IST"
            />
            <Stat
              label="On time today"
              value={head.onTimePct === null ? "—" : pct(head.onTimePct)}
              note="within SLA commit"
            />
            <Stat
              label="Freight on the board"
              value={inrCompact(head.totalFreightInr)}
              note={`${num(trips.length)} trips`}
            />
            <Stat
              label="Detention exposure"
              value={inrCompact(head.detentionCostInr)}
              note="beyond contracted free time"
            />
            <Stat
              label="Median cost"
              value={`₹${head.medianCostPerBtkm.toFixed(2)}`}
              unit="/ BTKM"
              note="across every corridor"
            />
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1fr]">
          <Panel>
            <PanelHeader
              title="Transporter scorecard"
              subtitle="Measured against contracted performance"
              actions={
                <Tooltip label="Every aggregate recomputed from live state" side="bottom">
                  <span className="font-mono text-[10.5px] tabular-nums text-ink-faint">
                    {computeMs.toFixed(1)} ms
                  </span>
                </Tooltip>
              }
            />
            <PanelBody scroll={false}>
              <Scorecard rows={carriers} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader
              title="Delay Pareto"
              subtitle="Which conditions consume the tower"
            />
            <PanelBody scroll={false}>
              <DelayPareto rows={pareto} />
            </PanelBody>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Corridor performance"
            subtitle="On-time delivery by four-hour window"
          />
          <PanelBody scroll={false}>
            <LaneHeat buckets={heat.buckets} rows={heat.rows} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Cost by corridor"
            subtitle="Freight per billed tonne-kilometre, dearest first"
          />
          <PanelBody scroll={false}>
            <CostView rows={cost} />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
