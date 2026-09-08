import { IST_OFFSET_MS } from "../domain/documents";

/* ============================================================================
   The road-speed profile, and the integral that makes movement drift-free.

   A truck does not cover ground at a constant rate. It crawls out of a city,
   runs well on open highway mid-morning, loses the early afternoon to heat and
   rest, and mostly stops overnight. Encoding that as an hour-of-day multiplier
   gives the map its rhythm: at 600× you watch the fleet stall around 02:00 IST
   and surge again after dawn.

   The important property is that distance covered is expressed as an INTEGRAL
   of this profile between two instants, computed in closed form rather than
   accumulated tick by tick. Nothing is added up over time, so nothing drifts —
   pausing, changing speed, or jumping the clock all land on the same answer.
   ========================================================================== */

const H = 3_600_000;
const DAY_MS = 86_400_000;

/** Relative road speed by IST hour. Normalised below to a daily mean of 1. */
const RAW_HOURLY = [
  0.35, 0.32, 0.30, 0.34, 0.45, // 00–04  night halt, a few still rolling
  0.85, 1.00,                    // 05–06  pre-dawn start
  1.25, 1.30, 1.25,              // 07–09  best running of the day
  1.20, 1.18, 1.10,              // 10–12
  0.72, 0.68,                    // 13–14  heat and the driver's rest
  1.15, 1.22, 1.20, 1.10,        // 15–18
  1.05, 1.00, 0.92,              // 19–21
  0.62, 0.45,                    // 22–23  winding down
];

/**
 * Normalised so the day sums to 24. That keeps a lane's contracted transit
 * meaning what it says: a 42-hour lane still takes 42 hours end to end, the
 * hours are just spent unevenly.
 */
export const HOURLY_SPEED: number[] = (() => {
  const sum = RAW_HOURLY.reduce((a, b) => a + b, 0);
  return RAW_HOURLY.map((v) => (v * 24) / sum);
})();

/** Cumulative units at the start of each hour; CUM[24] === 24. */
const CUM: number[] = (() => {
  const out = [0];
  for (let h = 0; h < 24; h++) out.push(out[h] + HOURLY_SPEED[h]);
  return out;
})();

/** IST hour of day, 0–23, for a UTC instant. */
export function istHourOf(ms: number): number {
  return Math.floor((((ms + IST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / H);
}

/** Speed multiplier in force at an instant. 1 is the daily average. */
export function speedFactorAt(ms: number): number {
  return HOURLY_SPEED[istHourOf(ms)];
}

/**
 * Profile units accumulated from the epoch to `ms`. One unit is one hour of
 * average-speed running, so the difference between two calls is the effective
 * driving time between them.
 */
function unitsAt(ms: number): number {
  const local = ms + IST_OFFSET_MS;
  const days = Math.floor(local / DAY_MS);
  const rem = local - days * DAY_MS;
  const h = Math.floor(rem / H);
  const frac = (rem - h * H) / H;
  return days * 24 + CUM[h] + HOURLY_SPEED[h] * frac;
}

/** Effective driving time between two instants, in profile units. */
export function integrate(fromMs: number, toMs: number): number {
  if (toMs <= fromMs) return 0;
  return unitsAt(toMs) - unitsAt(fromMs);
}

/** Inverse of `unitsAt` — the instant at which a unit count is reached. */
function timeAtUnits(units: number): number {
  const days = Math.floor(units / 24);
  let rem = units - days * 24;
  let h = 0;
  while (h < 23 && CUM[h + 1] <= rem) h++;
  const frac = (rem - CUM[h]) / HOURLY_SPEED[h];
  return days * DAY_MS + h * H + frac * H - IST_OFFSET_MS;
}

/**
 * The instant `units` of effective driving after `fromMs`. Inverting the
 * profile is what lets an ETA be projected forward through tonight's halt
 * instead of naively extrapolating the current speed.
 */
export function advanceBy(fromMs: number, units: number): number {
  if (units <= 0) return fromMs;
  return timeAtUnits(unitsAt(fromMs) + units);
}
