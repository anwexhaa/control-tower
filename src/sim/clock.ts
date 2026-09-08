/* The simulation clock, decoupled from wall time.

   Sim time only ever moves when `advance` is called, by an amount the caller
   controls. Nothing in the app reads Date.now(), so the whole board can be
   paused, run at 600×, or scrubbed to a different hour and every derived
   figure follows without special-casing. */

export const SPEEDS = [0, 1, 60, 600] as const;
export type Speed = (typeof SPEEDS)[number];

export class SimClock {
  private simMs: number;
  private speed: Speed = 60;
  private lastWallMs: number | null = null;

  constructor(epochMs: number) {
    this.simMs = epochMs;
  }

  now(): number {
    return this.simMs;
  }

  getSpeed(): Speed {
    return this.speed;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    // Drop the wall reference so a pause does not bank elapsed real time and
    // then apply it in one jump when the clock restarts.
    this.lastWallMs = null;
  }

  isPaused(): boolean {
    return this.speed === 0;
  }

  /**
   * Move sim time forward by the wall time elapsed since the last call,
   * multiplied by the current speed. Returns the new simulation instant.
   */
  advance(wallMs: number): number {
    if (this.lastWallMs === null) {
      this.lastWallMs = wallMs;
      return this.simMs;
    }
    const elapsed = wallMs - this.lastWallMs;
    this.lastWallMs = wallMs;
    if (this.speed === 0 || elapsed <= 0) return this.simMs;

    // Cap the step so a backgrounded tab that wakes after ten minutes does not
    // fast-forward the fleet by four days in a single tick.
    const step = Math.min(elapsed, 5_000) * this.speed;
    this.simMs += step;
    return this.simMs;
  }

  /** Jump the clock. Used by the 24-hour scrub. */
  scrubTo(ms: number): void {
    this.simMs = ms;
    this.lastWallMs = null;
  }
}
