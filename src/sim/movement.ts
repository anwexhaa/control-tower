import type { GpsGap, Incident, Trip } from "../domain/types";
import { advanceBy, integrate, speedFactorAt } from "./profile";

const H = 3_600_000;

/* Where a truck is, how fast it is going, and when it will arrive — all
   derived from the clock rather than stepped forward. Every function here is
   pure in (trip, instant), which is what makes pause, scrub and 600× playback
   land on identical answers. */

/** Effective driving time the lane needs at pace 1, in profile units. */
export function requiredUnits(trip: Trip): number {
  return integrate(trip.dispatchedAt, trip.dispatchedAt + trip.plannedTransitMs);
}

function incidentEnd(i: Incident): number {
  return i.at + i.hours * H;
}

/** Driving time lost to incidents between dispatch and `to`. */
function lostUnits(trip: Trip, to: number, knownAt: number): number {
  let lost = 0;
  for (const inc of trip.incidents) {
    if (inc.at > knownAt) break;
    const from = Math.max(inc.at, trip.dispatchedAt);
    const until = Math.min(incidentEnd(inc), to);
    if (until > from) lost += integrate(from, until);
  }
  return lost;
}

/**
 * Fraction of the lane covered at `now`, clamped to 0–1.
 *
 * Note there is no accumulator here: the answer is a difference of two
 * closed-form integrals, so it cannot drift no matter how the clock is driven.
 */
export function progressAt(trip: Trip, now: number): number {
  if (now <= trip.dispatchedAt) return 0;
  const need = requiredUnits(trip);
  if (need <= 0) return 1;
  const driven = integrate(trip.dispatchedAt, now) - lostUnits(trip, now, Infinity);
  return Math.max(0, Math.min(1, (driven * trip.paceFactor) / need));
}

/**
 * When the truck reaches the destination.
 *
 * `knownAt` is the point past which incidents have not happened yet as far as
 * the caller is concerned. Pass `Infinity` for the truth; pass the current
 * instant for what the control tower can legitimately project, which is what
 * makes an ETA slip the moment a truck actually stops rather than in advance.
 */
export function arrivalAt(trip: Trip, knownAt = Infinity): number {
  const need = requiredUnits(trip) / trip.paceFactor;
  let cursor = trip.dispatchedAt;
  let driven = 0;

  for (const inc of trip.incidents) {
    if (inc.at > knownAt) break;
    const end = incidentEnd(inc);
    if (end <= cursor) continue;

    const start = Math.max(inc.at, cursor);
    const units = integrate(cursor, start);
    if (driven + units >= need) return advanceBy(cursor, need - driven);

    driven += units;
    cursor = end;
  }

  return advanceBy(cursor, need - driven);
}

/** Average road speed the lane implies, before the hour-of-day profile. */
export function averageKmph(trip: Trip, distanceKm: number): number {
  const need = requiredUnits(trip);
  return need > 0 ? distanceKm / need : 0;
}

export function activeIncidentAt(trip: Trip, now: number): Incident | null {
  for (const inc of trip.incidents) {
    if (inc.at > now) break;
    if (now < incidentEnd(inc)) return inc;
  }
  return null;
}

/** Instantaneous road speed. Zero while halted, stopped or not yet rolling. */
export function speedKmphAt(
  trip: Trip,
  now: number,
  distanceKm: number,
  arrived: number | null,
): number {
  if (now < trip.dispatchedAt) return 0;
  if (arrived !== null && now >= arrived) return 0;
  if (activeIncidentAt(trip, now)) return 0;
  return averageKmph(trip, distanceKm) * speedFactorAt(now) * trip.paceFactor;
}

function gapEnd(g: GpsGap): number {
  return g.at + g.hours * H;
}

/** Last telemetry received. Frozen at the start of a dark window. */
export function lastPingAt(trip: Trip, now: number): number {
  for (const gap of trip.gpsGaps) {
    if (gap.at > now) break;
    if (now < gapEnd(gap)) return gap.at;
  }
  return now;
}
