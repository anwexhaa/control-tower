import { laneLabel, LANE_BY_ID } from "../../domain/lanes";
import { EXCEPTION_DEFS } from "../../domain/exceptions";
import { age } from "../../domain/format";
import type { QueueItem } from "../../domain/kpis";
import { transporterName } from "../../domain/transporters";
import { cx } from "../../lib/cx";
import { Chip, SeverityDot } from "../../ui";

/* Worst first, oldest first inside a band, already-acknowledged items sunk.
   Triage actions — acknowledge, assign, snooze, resolve — land in phase 4. */

export function ExceptionQueue({
  items,
  now,
  limit = 60,
  selectedId = null,
  onSelect,
}: {
  items: QueueItem[];
  now: number;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (tripId: string) => void;
}) {
  return (
    <div className="flex flex-col">
      {items.slice(0, limit).map(({ trip, exception }) => {
        const lane = LANE_BY_ID.get(trip.laneId)!;
        const def = EXCEPTION_DEFS[exception.code];
        return (
          <article
            key={exception.id}
            onClick={onSelect ? () => onSelect(trip.id) : undefined}
            className={cx(
              "flex gap-2.5 border-b border-line-soft px-3 py-2.5 last:border-0",
              onSelect && "cursor-pointer",
              trip.id === selectedId ? "bg-accent-soft" : "hover:bg-hover",
            )}
          >
            <SeverityDot
              severity={exception.severity}
              className="mt-1.5"
              pulse={exception.severity === "critical" && exception.acknowledgedAt === null}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <Chip tone="neutral" mono>
                  {exception.code}
                </Chip>
                <span className="truncate text-[12.5px] font-medium text-ink">
                  {def.label}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint tabular-nums">
                  {age(exception.raisedAt, now)}
                </span>
              </div>

              <p className="mt-1 truncate text-[12px] text-ink-soft">{exception.detail}</p>

              <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-mute">
                <span className="font-mono">{trip.docs.lrNo}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{laneLabel(lane)}</span>
              </div>

              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                <span className="truncate">{transporterName(trip.transporterCode)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{trip.vehicle.regNo}</span>
                {exception.acknowledgedAt !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-ok">
                      Ack {exception.acknowledgedBy}
                    </span>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
