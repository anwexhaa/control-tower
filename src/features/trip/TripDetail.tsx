import { useMemo, useState, type ReactNode } from "react";
import { commodityName } from "../../domain/commodities";
import { EXCEPTION_DEFS, EXCEPTION_CODES } from "../../domain/exceptions";
import { vehicleLabel } from "../../domain/fleet";
import { age, duration, istDateTime, mt } from "../../domain/format";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { transporterName } from "../../domain/transporters";
import type { ExceptionCode, Severity, Trip, TripState } from "../../domain/types";
import { cx } from "../../lib/cx";
import { simStore } from "../../store/simStore";
import {
  Button,
  Chip,
  Drawer,
  Modal,
  Select,
  SeverityDot,
  StatusPill,
  useToast,
} from "../../ui";
import { STATUS_LABEL, STATUS_TONE } from "../track/present";
import { DocumentPanel } from "./DocumentPanel";
import { PingTrail } from "./PingTrail";
import { TelemetryChart } from "./TelemetryChart";
import { Timeline } from "./Timeline";
import { deriveMilestones } from "./milestones";
import { bandFor, speedSeries, temperatureSeries } from "./telemetry";

const H = 3_600_000;

const SEVERITY_TONE = {
  critical: "crit",
  high: "warn",
  medium: "info",
  low: "neutral",
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line-soft pt-3 first:border-0 first:pt-0">
      <h3 className="mb-2 text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium tracking-[0.09em] text-ink-faint uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[12.5px] text-ink-soft">{value}</dd>
    </div>
  );
}

export function TripDetail({
  trip,
  state,
  now,
  onClose,
}: {
  trip: Trip | null;
  state: TripState | null;
  now: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);
  const [code, setCode] = useState<ExceptionCode>("EX-02");
  const [severity, setSeverity] = useState<Severity>("medium");

  const open = trip !== null && state !== null;

  const milestones = useMemo(
    () => (trip && state ? deriveMilestones(trip, state, now) : []),
    [trip, state, now],
  );
  const speed = useMemo(
    () => (trip && state ? speedSeries(trip, state, now) : []),
    [trip, state, now],
  );
  const band = trip ? bandFor(trip.commodityCode) : null;
  const temps = useMemo(
    () => (trip && state && band ? temperatureSeries(trip, state, now, band) : []),
    [trip, state, now, band],
  );

  if (!open) {
    return <Drawer open={false} onClose={onClose} title="" width={640}>{null}</Drawer>;
  }

  const lane = LANE_BY_ID.get(trip.laneId)!;
  const openExceptions = state.exceptions.filter((e) => e.resolvedAt === null);
  const closedExceptions = state.exceptions.filter((e) => e.resolvedAt !== null);

  const run = async (key: string, work: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(key);
    const result = await work();
    setBusy(null);
    toast.push({
      tone: result.ok ? "ok" : "crit",
      title: result.ok ? "Done" : "Rolled back",
      detail: result.message,
    });
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width={640}
        title={trip.docs.lrNo}
        subtitle={`${laneLabel(lane)} · ${transporterName(trip.transporterCode)}`}
        footer={
          <>
            <Button
              size="sm"
              variant="ghost"
              loading={busy === "driver"}
              onClick={() => run("driver", () => simStore.notifyDriver(trip.id))}
            >
              Call driver
            </Button>
            <Button
              size="sm"
              variant="ghost"
              loading={busy === "transporter"}
              onClick={() =>
                run("transporter", () =>
                  simStore.notifyTransporter(trip.id, transporterName(trip.transporterCode)),
                )
              }
            >
              Escalate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRaising(true)}>
              Raise exception
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={busy === "eta"}
              onClick={() =>
                run("eta", () =>
                  // Commit the projection rounded up to the next hour, which is
                  // what actually gets said on the phone.
                  simStore.agreeEta(trip.id, Math.ceil(state.etaAt / H) * H),
                )
              }
            >
              Agree ETA
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* --------------------------------------------------------- status */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[state.status]}>
              {STATUS_LABEL[state.status]}
            </StatusPill>
            {state.activeIncident && (
              <Chip tone="warn">
                Halted {duration((now - state.activeIncident.at) / H)} ·{" "}
                {state.activeIncident.where}
              </Chip>
            )}
            {state.delayHours > 0 ? (
              <Chip tone="crit">{duration(state.delayHours)} past commit</Chip>
            ) : (
              <Chip tone="ok">
                {duration((trip.slaCommitAt - state.etaAt) / H)} ahead of commit
              </Chip>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
            <Fact label="Vehicle" value={<span className="font-mono">{trip.vehicle.regNo}</span>} />
            <Fact label="Type" value={vehicleLabel(trip.vehicle.typeCode)} />
            <Fact label="Telemetry" value={trip.vehicle.gpsProvider} />
            <Fact label="Driver" value={trip.driver.name} />
            <Fact label="Contact" value={<span className="font-mono">{trip.driver.phoneMasked}</span>} />
            <Fact label="Licence" value={<span className="font-mono">{trip.driver.licenceNo}</span>} />
            <Fact label="Cargo" value={commodityName(trip.commodityCode)} />
            <Fact label="Weight" value={mt(trip.weightMt)} />
            <Fact label="Last ping" value={state.status === "planned" ? "—" : `${age(state.lastPingAt, now)} ago`} />
            <Fact label="SLA commit" value={<span className="font-mono">{istDateTime(trip.slaCommitAt)}</span>} />
            <Fact
              label="Projected"
              value={<span className="font-mono">{istDateTime(state.etaAt)}</span>}
            />
            <Fact
              label="Agreed"
              value={
                state.agreedEtaAt !== null ? (
                  <span className="font-mono text-accent">{istDateTime(state.agreedEtaAt)}</span>
                ) : (
                  <span className="text-ink-faint">not committed</span>
                )
              }
            />
          </dl>

          <Section title="Road travelled">
            <PingTrail trip={trip} state={state} now={now} />
          </Section>

          <Section title="Telemetry">
            <div className="flex flex-col gap-3">
              <TelemetryChart samples={speed} unit="km/h" label="Road speed" />
              {band && (
                <TelemetryChart
                  samples={temps}
                  unit="°C"
                  band={band}
                  label="Box temperature"
                />
              )}
            </div>
          </Section>

          <Section title="Milestones">
            <Timeline milestones={milestones} now={now} />
          </Section>

          <Section title="Documents">
            <DocumentPanel trip={trip} state={state} now={now} />
          </Section>

          <Section title={`Exceptions (${openExceptions.length} open)`}>
            {state.exceptions.length === 0 ? (
              <p className="text-[12px] text-ink-mute">
                Nothing has been raised against this trip.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...openExceptions, ...closedExceptions].map((e) => (
                  <li
                    key={e.id}
                    className={cx(
                      "flex gap-2.5 rounded-sm border p-2",
                      e.resolvedAt === null
                        ? "border-line bg-raised"
                        : "border-line-soft bg-sunken opacity-70",
                    )}
                  >
                    <SeverityDot severity={e.severity} className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <Chip tone={SEVERITY_TONE[e.severity]} mono>
                          {e.code}
                        </Chip>
                        <span className="truncate text-[12px] font-medium text-ink">
                          {EXCEPTION_DEFS[e.code].label}
                        </span>
                        {e.manual && <Chip tone="neutral">manual</Chip>}
                        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-faint tabular-nums">
                          {age(e.raisedAt, now)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-ink-soft">{e.detail}</p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {e.acknowledgedAt !== null && `Ack ${e.acknowledgedBy} · `}
                        {e.resolvedAt !== null
                          ? e.resolution === "cleared"
                            ? "Cleared on its own"
                            : `Actioned${e.resolutionNote ? ` — ${e.resolutionNote}` : ""}`
                          : "Open"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Controller notes (${state.notes.length})`}>
            <div className="flex flex-col gap-2">
              {state.notes.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {state.notes.map((n) => (
                    <li key={n.id} className="rounded-sm border border-line-soft bg-sunken p-2">
                      <p className="text-[12px] text-ink-soft">{n.text}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                        {n.by} · {istDateTime(n.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && note.trim()) {
                      e.preventDefault();
                      const text = note.trim();
                      setNote("");
                      void run("note", () => simStore.addNote(trip.id, text));
                    }
                  }}
                  placeholder="Add a note for the next shift…"
                  className="h-8.5 min-w-0 flex-1 rounded-sm border border-line bg-panel px-2.5 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-accent"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!note.trim()}
                  loading={busy === "note"}
                  onClick={() => {
                    const text = note.trim();
                    setNote("");
                    void run("note", () => simStore.addNote(trip.id, text));
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </Section>
        </div>
      </Drawer>

      <Modal
        open={raising}
        onClose={() => setRaising(false)}
        title="Raise an exception"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRaising(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setRaising(false);
                void run("raise", () =>
                  simStore.raiseException(
                    trip.id,
                    code,
                    severity,
                    `Raised by hand — ${EXCEPTION_DEFS[code].label.toLowerCase()}`,
                  ),
                );
              }}
            >
              Raise
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Code"
            value={code}
            onChange={(e) => {
              const next = e.currentTarget.value as ExceptionCode;
              setCode(next);
              setSeverity(EXCEPTION_DEFS[next].severity);
            }}
          >
            {EXCEPTION_CODES.map((c) => (
              <option key={c} value={c}>
                {c} · {EXCEPTION_DEFS[c].label}
              </option>
            ))}
          </Select>

          <Select
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.currentTarget.value as Severity)}
          >
            {(["low", "medium", "high", "critical"] as Severity[]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <p className="text-[11.5px] text-ink-mute">
            A hand-raised exception is invisible to its rule — the engine will neither
            refresh nor clear it. Somebody put it there, so somebody takes it away.
          </p>
        </div>
      </Modal>
    </>
  );
}
