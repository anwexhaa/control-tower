import { inr, inrCompact, num } from "../../domain/format";
import { DETENTION_RATE_INR_PER_HOUR, type CostRow } from "./aggregate";

/* Freight cost per billed tonne-kilometre, by corridor.

   Cost per BTKM carries the bar because it is the unit freight is actually
   judged on — it is the one figure that compares a 300 km run against a
   1,600 km one. Cost per MT and the detention estimate sit beside it as
   numbers rather than as a second set of bars: they are measured on different
   scales, and putting two scales on one chart is how a reader gets told
   whatever the author wanted. */

export function CostView({ rows }: { rows: CostRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[12.5px] text-ink-mute">
        No corridor is carrying freight yet.
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => r.costPerBtkm));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="pb-1.5 text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                Corridor
              </th>
              <th className="pb-1.5 pr-2 text-right text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                Trips
              </th>
              <th className="w-[190px] pb-1.5 text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                ₹ / BTKM
              </th>
              <th className="pb-1.5 pr-2 text-right text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                ₹ / MT
              </th>
              <th className="pb-1.5 text-right text-[10px] font-medium tracking-[0.09em] text-ink-mute uppercase">
                Detention
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.laneId} className="border-b border-line-soft last:border-0">
                <td className="max-w-[210px] truncate py-1.5 pr-2 text-[11.5px] text-ink-soft">
                  {r.label}
                  <span className="ml-1.5 font-mono text-[10px] text-ink-faint">
                    {num(r.distanceKm)} km
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-[11px] tabular-nums text-ink-faint">
                  {r.trips}
                </td>
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 min-w-0 flex-1 rounded-xs bg-sunken">
                      <div
                        className="h-full rounded-xs bg-accent"
                        style={{ width: `${Math.max(3, (r.costPerBtkm / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-[42px] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink">
                      {r.costPerBtkm.toFixed(2)}
                    </span>
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-[11px] tabular-nums text-ink-soft">
                  {num(Math.round(r.costPerMt))}
                </td>
                <td className="py-1.5 text-right font-mono text-[11px] tabular-nums text-ink-mute">
                  {r.detentionCostInr > 0 ? inrCompact(r.detentionCostInr) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10.5px] text-ink-faint">
        BTKM is billed tonnes × kilometres run. Detention is estimated at{" "}
        {inr(DETENTION_RATE_INR_PER_HOUR)} per hour beyond contracted free time — 8 hours
        at origin, 6 at destination.
      </p>
    </div>
  );
}
