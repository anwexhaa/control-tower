import { duration, num, pct } from "../../domain/format";
import type { Kpis } from "../../domain/kpis";
import { Metric, Panel } from "../../ui";

/* Summary before detail. Sparklines and click-to-filter arrive in phase 4;
   the figures themselves are already the real ones. */

export function KpiStrip({ kpis }: { kpis: Kpis }) {
  const cells = [
    { label: "In transit", value: num(kpis.inTransit), unit: "trips" },
    { label: "On-time delivery", value: pct(kpis.onTimePct), unit: "" },
    { label: "At risk", value: num(kpis.atRisk), unit: "" },
    { label: "Delivered today", value: num(kpis.deliveredToday), unit: "" },
    { label: "Avg delay", value: duration(kpis.avgDelayH), unit: "" },
    { label: "Visibility", value: pct(kpis.visibilityPct), unit: "" },
  ];

  return (
    <Panel className="shrink-0">
      <div className="grid grid-cols-2 divide-line-soft sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="px-4 py-3">
            <Metric label={c.label} value={c.value} unit={c.unit} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
