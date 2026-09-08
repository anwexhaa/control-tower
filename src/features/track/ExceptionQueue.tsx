import { useState } from "react";
import { EXCEPTION_DEFS } from "../../domain/exceptions";
import { age } from "../../domain/format";
import type { QueueItem } from "../../domain/kpis";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { transporterName } from "../../domain/transporters";
import type { Severity, TripException } from "../../domain/types";
import { cx } from "../../lib/cx";
import { simStore } from "../../store/simStore";
import { Button, Chip, Modal, Select, SeverityDot, Tooltip, useToast } from "../../ui";
import { IconCheck, IconClose } from "../../ui/icons";

/* Worst first, oldest first inside a band, already-acknowledged items sunk.

   Ageing is shown as colour rather than only as a number, and the threshold
   scales with severity — a critical that has sat for forty minutes is a worse
   sign than a low that has sat all day. */

const H = 3_600_000;

/** Hours before an unactioned exception turns amber, then red. */
const AGE_THRESHOLDS: Record<Severity, [number, number]> = {
  critical: [0.5, 2],
  high: [2, 6],
  medium: [8, 24],
  low: [12, 48],
};

const RESOLUTION_REASONS = [
  "Transporter confirmed recovery",
  "Driver contacted, moving again",
  "Fresh e-way bill raised",
  "Consignee accepted revised ETA",
  "Vehicle swapped at the nearest hub",
  "False alarm — telemetry fault",
  "Detention claim raised with the plant",
];

function ageTone(e: TripException, now: number): string {
  const hours = (now - e.raisedAt) / H;
  const [amber, red] = AGE_THRESHOLDS[e.severity];
  if (e.acknowledgedAt !== null) return "text-ink-faint";
  if (hours >= red) return "text-crit";
  if (hours >= amber) return "text-warn";
  return "text-ink-faint";
}

export function ExceptionQueue({
  items,
  now,
  limit = 80,
  selectedId = null,
  onSelect,
}: {
  items: QueueItem[];
  now: number;
  limit?: number;
  selectedId?: string | null;
  onSelect?: (tripId: string) => void;
}) {
  const toast = useToast();
  const [resolving, setResolving] = useState<QueueItem | null>(null);
  const [reason, setReason] = useState(RESOLUTION_REASONS[0]);

  return (
    <div className="flex flex-col">
      {items.slice(0, limit).map(({ trip, exception }) => {
        const lane = LANE_BY_ID.get(trip.laneId)!;
        const def = EXCEPTION_DEFS[exception.code];
        const isSelected = trip.id === selectedId;

        return (
          <article
            key={exception.id}
            onClick={onSelect ? () => onSelect(trip.id) : undefined}
            className={cx(
              "group/row flex gap-2.5 border-b border-line-soft px-3 py-2.5 last:border-0",
              onSelect && "cursor-pointer",
              isSelected ? "bg-accent-soft" : "hover:bg-hover",
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
                <span
                  className={cx(
                    "ml-auto shrink-0 font-mono text-[11px] tabular-nums",
                    ageTone(exception, now),
                  )}
                  title={`Raised ${age(exception.raisedAt, now)} ago`}
                >
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
                    <span className="truncate text-ok">Ack {exception.acknowledgedBy}</span>
                  </>
                )}
                {exception.snoozedUntil !== null && exception.snoozedUntil > now && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate text-info">
                      Snoozed {age(now, exception.snoozedUntil)}
                    </span>
                  </>
                )}
              </div>

              {/* Triage. Revealed on hover or focus so the queue stays scannable. */}
              <div
                className={cx(
                  "mt-1.5 flex items-center gap-1 transition-opacity",
                  "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
                  isSelected && "opacity-100",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Tooltip label="Take this exception" side="top">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={exception.acknowledgedAt !== null}
                    leading={<IconCheck size={13} />}
                    onClick={() => {
                      simStore.acknowledge(trip.id, exception.id);
                      toast.push({
                        tone: "ok",
                        title: "Acknowledged",
                        detail: `${exception.code} on ${trip.docs.lrNo}`,
                      });
                    }}
                  >
                    {exception.acknowledgedAt !== null ? "Taken" : "Ack"}
                  </Button>
                </Tooltip>

                <Select
                  aria-label="Snooze"
                  className="w-[92px]"
                  value=""
                  onChange={(e) => {
                    const hours = Number(e.currentTarget.value);
                    if (!hours) return;
                    simStore.snooze(trip.id, exception.id, hours);
                    toast.push({
                      tone: "info",
                      title: `Snoozed ${hours}h`,
                      detail: `${exception.code} returns to the queue when it lapses`,
                    });
                  }}
                >
                  <option value="">Snooze</option>
                  <option value="2">2 hours</option>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                </Select>

                <Button
                  size="sm"
                  variant="ghost"
                  leading={<IconClose size={13} />}
                  onClick={() => {
                    setReason(RESOLUTION_REASONS[0]);
                    setResolving({ trip, exception });
                  }}
                >
                  Resolve
                </Button>
              </div>
            </div>
          </article>
        );
      })}

      <Modal
        open={resolving !== null}
        onClose={() => setResolving(null)}
        title={
          resolving
            ? `Resolve ${resolving.exception.code} · ${resolving.trip.docs.lrNo}`
            : "Resolve"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!resolving) return;
                simStore.resolve(resolving.trip.id, resolving.exception.id, reason);
                toast.push({
                  tone: "ok",
                  title: "Exception resolved",
                  detail: reason,
                });
                setResolving(null);
              }}
            >
              Resolve
            </Button>
          </>
        }
      >
        {resolving && (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] text-ink-soft">{resolving.exception.detail}</p>
            <Select
              label="Resolution"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            >
              {RESOLUTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <p className="text-[11.5px] text-ink-mute">
              Closing this by hand records it as actioned rather than cleared. If the
              underlying condition is still true, the rule raises it again on the next
              tick — resolving is a statement about the response, not the road.
            </p>
          </div>
        )}
      </Modal>

      {items.length > limit && (
        <p className="px-3 py-2 text-[11.5px] text-ink-faint">
          {items.length - limit} more open below the top {limit}. Narrow the filter to
          see them.
        </p>
      )}
    </div>
  );
}
