import { useSyncExternalStore } from "react";
import { buildQueue, computeKpis, type Kpis, type QueueItem } from "../domain/kpis";
import type { ExceptionCode, Severity, Trip, TripState } from "../domain/types";
import { SimClock, type Speed } from "../sim/clock";
import { Engine, type SimEvent } from "../sim/engine";
import { DEFAULT_EPOCH, DEFAULT_SEED, DEFAULT_TRIP_COUNT, generateNetwork } from "../sim/generate";

/* The single source of truth the UI reads.

   The tick runs at 1 Hz whatever the speed multiplier is — 600× means each
   tick advances ten simulated minutes, not that the loop runs faster. Cheap,
   and it keeps the frame budget for rendering rather than simulation. */

const TICK_MS = 1000;
const H = 3_600_000;

/** How much history the sparklines show, and how finely it is sampled. */
const HISTORY_HOURS = 24;
const HISTORY_STEP_MS = H;

export interface KpiSample extends Kpis {
  at: number;
}

export interface SimSnapshot {
  /** Bumped on every tick so useSyncExternalStore knows to re-read. */
  version: number;
  now: number;
  speed: Speed;
  trips: readonly Trip[];
  states: ReadonlyMap<string, TripState>;
  kpis: Kpis;
  /** Trailing 24 simulated hours, oldest first. */
  history: readonly KpiSample[];
  queue: QueueItem[];
  events: readonly SimEvent[];
  /** Wall-clock cost of the last step, surfaced in the UI as a health readout. */
  tickMs: number;
}

class SimStore {
  private readonly network = generateNetwork({
    seed: DEFAULT_SEED,
    count: DEFAULT_TRIP_COUNT,
    epoch: DEFAULT_EPOCH,
  });
  private readonly clock = new SimClock(DEFAULT_EPOCH);
  private readonly engine = new Engine(this.network);
  private readonly listeners = new Set<() => void>();
  private history: KpiSample[] = [];
  private lastSampleAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private version = 0;
  private snapshot: SimSnapshot;

  constructor() {
    this.history = this.backfillHistory();
    this.lastSampleAt = DEFAULT_EPOCH;
    this.snapshot = this.build(0);
  }

  /**
   * The sparklines show real history rather than filling in over the first few
   * minutes. A throwaway engine replays the day before the epoch and the KPIs
   * are captured hourly; it is discarded, so none of its exception state
   * leaks into the live board. Roughly 45 ms at startup.
   */
  private backfillHistory(): KpiSample[] {
    const past = new Engine(this.network);
    const samples: KpiSample[] = [];

    for (let h = HISTORY_HOURS; h >= 1; h--) {
      const at = DEFAULT_EPOCH - h * HISTORY_STEP_MS;
      const states = past.step(at);
      samples.push({ at, ...computeKpis(this.network.trips, states, at) });
    }
    return samples;
  }

  private build(tickMs: number): SimSnapshot {
    const now = this.clock.now();
    const states = this.engine.step(now);
    const kpis = computeKpis(this.network.trips, states, now);

    if (now - this.lastSampleAt >= HISTORY_STEP_MS) {
      this.lastSampleAt = now;
      this.history = [...this.history, { at: now, ...kpis }].slice(-HISTORY_HOURS);
    }

    return {
      version: ++this.version,
      now,
      speed: this.clock.getSpeed(),
      trips: this.network.trips,
      states,
      kpis,
      history: this.history,
      queue: buildQueue(this.network.trips, states, now),
      events: this.engine.getEvents(),
      tickMs,
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private refresh(): void {
    this.snapshot = this.build(this.snapshot.tickMs);
    this.emit();
  }

  private tick = (): void => {
    this.clock.advance(performance.now());
    const t0 = performance.now();
    const next = this.build(0);
    this.snapshot = { ...next, tickMs: performance.now() - t0 };
    this.emit();
  };

  /* ------------------------------------------------------------- lifecycle */

  private start(): void {
    if (this.timer !== null) return;
    this.clock.advance(performance.now()); // reset the wall reference
    this.timer = setInterval(this.tick, TICK_MS);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = (): SimSnapshot => this.snapshot;

  /* ---------------------------------------------------------------- inputs */

  setSpeed(speed: Speed): void {
    this.clock.setSpeed(speed);
    this.snapshot = { ...this.snapshot, speed };
    this.emit();
  }

  acknowledge(tripId: string, exceptionId: string, by = "A. Raman"): void {
    this.engine.acknowledge(tripId, exceptionId, by, this.clock.now());
    this.refresh();
  }

  resolve(tripId: string, exceptionId: string, note?: string): void {
    this.engine.resolve(tripId, exceptionId, this.clock.now(), note);
    this.refresh();
  }

  snooze(tripId: string, exceptionId: string, hours: number): void {
    this.engine.snooze(tripId, exceptionId, this.clock.now() + hours * H);
    this.refresh();
  }

  /* ------------------------------------------------- optimistic controller work

     Each of these applies its change immediately, then waits on a simulated
     round trip and undoes it if that fails. The controller sees the result of
     their action at once and only ever waits when something goes wrong, which
     is the right trade for a screen somebody works all shift.

     The failure is deterministic — every fifth outward-facing action — because
     a demo that fails at random is impossible to talk through.             */

  private actionSeq = 0;

  private roundTrip(): Promise<boolean> {
    const willFail = this.actionSeq++ % 5 === 4;
    return new Promise((resolve) => setTimeout(() => resolve(!willFail), 700));
  }

  /** Adds a note straight away, removes it again if the write does not land. */
  async addNote(tripId: string, text: string, by = "A. Raman"): Promise<ActionOutcome> {
    const note = this.engine.addNote(tripId, text, by, this.clock.now());
    this.refresh();

    if (await this.roundTrip()) return { ok: true, message: "Note saved" };

    this.engine.removeNote(tripId, note.id);
    this.refresh();
    return { ok: false, message: "Could not save the note — it has been rolled back" };
  }

  /** Commits a revised ETA to the consignee, alongside the projection. */
  async agreeEta(tripId: string, at: number): Promise<ActionOutcome> {
    const previous = this.snapshot.states.get(tripId)?.agreedEtaAt ?? null;
    this.engine.setAgreedEta(tripId, at, this.clock.now());
    this.refresh();

    if (await this.roundTrip()) return { ok: true, message: "Revised ETA agreed" };

    this.engine.setAgreedEta(tripId, previous, this.clock.now());
    this.refresh();
    return { ok: false, message: "Consignee did not confirm — the revision was rolled back" };
  }

  async raiseException(
    tripId: string,
    code: ExceptionCode,
    severity: Severity,
    detail: string,
    by = "A. Raman",
  ): Promise<ActionOutcome> {
    const ex = this.engine.raiseManual(tripId, code, severity, detail, by, this.clock.now());
    this.refresh();

    if (await this.roundTrip()) return { ok: true, message: `${code} raised` };

    this.engine.dropException(tripId, ex.id);
    this.refresh();
    return { ok: false, message: `Could not raise ${code} — it has been rolled back` };
  }

  /**
   * Reaching the driver depends on the vehicle being reachable. This one fails
   * for a reason rather than by dice: a truck in a coverage hole cannot be
   * called, which is exactly the situation EX-03 exists to surface.
   */
  async notifyDriver(tripId: string): Promise<ActionOutcome> {
    const state = this.snapshot.states.get(tripId);
    const dark = state ? this.clock.now() - state.lastPingAt > 3 * H : false;

    await new Promise((r) => setTimeout(r, 400));
    if (dark) {
      return { ok: false, message: "Vehicle is out of coverage — no ping for over 3 hours" };
    }
    this.engine.logNotification(tripId, "Driver contacted", this.clock.now());
    this.refresh();
    return { ok: true, message: "Driver contacted" };
  }

  async notifyTransporter(tripId: string, name: string): Promise<ActionOutcome> {
    this.engine.logNotification(tripId, `Escalated to ${name}`, this.clock.now());
    this.refresh();
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, message: `${name} notified` };
  }
}

export interface ActionOutcome {
  ok: boolean;
  message: string;
}

export const simStore = new SimStore();

export function useSim(): SimSnapshot {
  return useSyncExternalStore(simStore.subscribe, simStore.getSnapshot, simStore.getSnapshot);
}
