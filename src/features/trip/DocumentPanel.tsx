import { CONSIGNOR, ewayValidityDays } from "../../domain/documents";
import { duration, inr, istDateTime } from "../../domain/format";
import { LANE_BY_ID } from "../../domain/lanes";
import type { Trip, TripState } from "../../domain/types";
import { cx } from "../../lib/cx";
import { Chip, type Tone } from "../../ui";

/* The paperwork that rides with the truck.

   The e-way bill is the one that bites: it expires on a clock the tower does
   not own, and a vehicle stopped with an expired bill is detained and fined.
   Its countdown is driven by the simulation clock, so it moves at 600× too. */

const H = 3_600_000;

function Row({
  label,
  value,
  mono = true,
  tone,
  note,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  tone?: Tone;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line-soft py-2 last:border-0">
      <span className="w-[112px] shrink-0 text-[10.5px] font-medium tracking-[0.09em] text-ink-mute uppercase">
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className={cx(
            "text-[12.5px] text-ink-soft",
            mono && "font-mono tabular-nums",
            tone === "crit" && "text-crit",
            tone === "warn" && "text-warn",
            tone === "ok" && "text-ok",
          )}
        >
          {value}
        </span>
        {note && <div className="mt-0.5 text-[11px] text-ink-faint">{note}</div>}
      </div>
    </div>
  );
}

/**
 * Validity remaining against distance still to run. Reads from the sim clock,
 * so pausing freezes it and 600× burns it down in front of you.
 */
export function EwayCountdown({
  trip,
  state,
  now,
}: {
  trip: Trip;
  state: TripState;
  now: number;
}) {
  const lane = LANE_BY_ID.get(trip.laneId)!;
  const leftH = (trip.docs.ewayValidUntil - now) / H;
  const remainingKm = Math.max(0, lane.distanceKm - state.coveredKm);
  const running = state.status === "in_transit" || state.status === "at_risk";

  const tone: Tone =
    !running || remainingKm < 1 ? "neutral" : leftH <= 0 ? "crit" : leftH < 6 ? "warn" : "ok";

  const text =
    leftH <= 0
      ? `Expired ${duration(-leftH)} ago`
      : `${duration(leftH)} left`;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cx(
          "font-mono text-[12.5px] tabular-nums",
          tone === "crit" && "text-crit",
          tone === "warn" && "text-warn",
          tone === "ok" && "text-ok",
          tone === "neutral" && "text-ink-mute",
        )}
      >
        {text}
      </span>
      {running && remainingKm >= 1 && (
        <Chip tone={tone}>{Math.round(remainingKm)} km to run</Chip>
      )}
    </div>
  );
}

export function DocumentPanel({
  trip,
  state,
  now,
}: {
  trip: Trip;
  state: TripState;
  now: number;
}) {
  const lane = LANE_BY_ID.get(trip.laneId)!;
  const days = ewayValidityDays(lane.distanceKm);

  const weighed = trip.docs.weighedMt;
  const variancePct =
    weighed === null ? 0 : ((weighed - trip.weightMt) / trip.weightMt) * 100;
  const overTolerance = Math.abs(variancePct) > 3;

  return (
    <div className="flex flex-col">
      <Row label="Consignor" value={CONSIGNOR.name} mono={false} note={CONSIGNOR.gstin} />

      <Row label="LR no." value={trip.docs.lrNo} />

      <Row
        label="E-way bill"
        value={trip.docs.ewayBillNo}
        note={
          <div className="flex flex-col gap-1">
            <EwayCountdown trip={trip} state={state} now={now} />
            <span>
              Valid to {istDateTime(trip.docs.ewayValidUntil)} · {days}{" "}
              {days === 1 ? "day" : "days"} for {lane.distanceKm} km under Rule 138
            </span>
          </div>
        }
      />

      <Row
        label="Tax invoice"
        value={trip.docs.invoiceNo}
        note={`${inr(trip.docs.invoiceValueInr)} cargo value`}
      />

      <Row
        label="Weighbridge"
        value={trip.docs.weighbridgeSlipNo ?? "—"}
        note={
          weighed === null ? (
            "Not yet weighed"
          ) : (
            <span className={overTolerance ? "text-warn" : undefined}>
              {weighed.toFixed(1)} MT weighed against {trip.weightMt.toFixed(1)} MT
              indented · {variancePct >= 0 ? "+" : "−"}
              {Math.abs(variancePct).toFixed(1)}%
              {overTolerance ? " — outside 3% tolerance" : ""}
            </span>
          )
        }
      />

      <Row
        label="POD"
        value={
          trip.docs.podUploadedAt !== null
            ? istDateTime(trip.docs.podUploadedAt)
            : state.status === "delivered"
              ? "Awaiting upload"
              : "—"
        }
        mono={trip.docs.podUploadedAt !== null}
        tone={trip.docs.podUploadedAt !== null ? "ok" : undefined}
        note={
          state.status === "delivered" && trip.docs.podUploadedAt === null
            ? "Unloading in progress; proof of delivery follows"
            : undefined
        }
      />

      <Row label="Freight" value={inr(trip.freightInr)} note={`${lane.distanceKm} km`} />
    </div>
  );
}
