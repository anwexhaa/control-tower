import { COMMODITY_BY_CODE } from "../../domain/commodities";
import { LANE_BY_ID } from "../../domain/lanes";
import type { Trip, TripState } from "../../domain/types";
import type { LatLng } from "../../map/projection";
import { placeOnRoute, routeFor } from "../../map/route";
import { progressAt, speedKmphAt } from "../../sim/movement";
import { arrivalAt } from "../../sim/movement";

/* Reconstructing what the truck reported, from the same functions that decide
   where it is. Nothing is stored per trip — the series are sampled on demand
   when a drawer opens, which is why 1,200 trips cost nothing until you look
   at one. */

const H = 3_600_000;

export interface Sample {
  at: number;
  value: number;
}

export interface TrailSegment {
  points: LatLng[];
  /** True when telemetry was dark across this stretch. */
  dark: boolean;
}

/** Sim instants from dispatch to now (or arrival), evenly spaced. */
function timeline(trip: Trip, state: TripState, now: number, samples: number): number[] {
  const end = Math.min(now, state.arrivedAt ?? now);
  if (end <= trip.dispatchedAt) return [];
  const step = (end - trip.dispatchedAt) / (samples - 1);
  return Array.from({ length: samples }, (_, i) => trip.dispatchedAt + i * step);
}

function inGap(trip: Trip, at: number): boolean {
  for (const gap of trip.gpsGaps) {
    if (gap.at > at) break;
    if (at < gap.at + gap.hours * H) return true;
  }
  return false;
}

export function speedSeries(
  trip: Trip,
  state: TripState,
  now: number,
  samples = 90,
): Sample[] {
  const lane = LANE_BY_ID.get(trip.laneId)!;
  const arrived = arrivalAt(trip, Infinity);
  return timeline(trip, state, now, samples).map((at) => ({
    at,
    value: speedKmphAt(trip, at, lane.distanceKm, at >= arrived ? arrived : null),
  }));
}

/* ------------------------------------------------------------ reefer band --- */

export interface TemperatureBand {
  min: number;
  max: number;
  label: string;
}

/** The band the cargo is contracted to hold. */
export function bandFor(commodityCode: string): TemperatureBand | null {
  const c = COMMODITY_BY_CODE.get(commodityCode);
  if (!c?.reefer) return null;
  return c.code === "FMC-FRZ"
    ? { min: -20, max: -16, label: "Frozen −20 to −16 °C" }
    : { min: 2, max: 8, label: "Chilled 2 to 8 °C" };
}

/**
 * A deterministic trace: a slow wobble inside the band, plus whatever the
 * scheduled excursions add on top. Same trip, same clock, same line.
 */
export function temperatureSeries(
  trip: Trip,
  state: TripState,
  now: number,
  band: TemperatureBand,
  samples = 90,
): Sample[] {
  const mid = (band.min + band.max) / 2;
  const halfBand = (band.max - band.min) / 2;

  return timeline(trip, state, now, samples).map((at) => {
    const hours = (at - trip.dispatchedAt) / H;
    // Two incommensurable periods so the trace does not look like a sine wave.
    const wobble =
      Math.sin(hours / 2.3) * halfBand * 0.45 + Math.sin(hours / 0.71) * halfBand * 0.2;

    let excess = 0;
    for (const ex of trip.excursions) {
      if (ex.at > at) break;
      const end = ex.at + ex.hours * H;
      if (at >= end) continue;
      // Ramp in and out rather than stepping, which is how a box actually warms.
      const t = (at - ex.at) / (end - ex.at);
      excess = ex.deltaC * Math.sin(Math.PI * t);
    }

    return { at, value: mid + wobble + excess };
  });
}

/* ------------------------------------------------------------- ping trail --- */

/**
 * The road travelled, split where the unit went quiet.
 *
 * A dark stretch is drawn as its own segment rather than interpolated into the
 * line, because a control tower that quietly joins the dots across a coverage
 * hole is asserting something it does not know.
 */
export function trailSegments(
  trip: Trip,
  state: TripState,
  now: number,
  samples = 80,
): TrailSegment[] {
  const route = routeFor(trip.laneId);
  const times = timeline(trip, state, now, samples);
  if (times.length === 0) return [];

  const segments: TrailSegment[] = [];
  let current: TrailSegment | null = null;

  for (const at of times) {
    const dark = inGap(trip, at);
    const place = placeOnRoute(route, progressAt(trip, at));

    if (!current || current.dark !== dark) {
      // Carry the last point into the new segment so the line stays joined.
      const seed: LatLng[] = current
        ? [current.points[current.points.length - 1]]
        : [];
      current = { points: [...seed, { lat: place.lat, lng: place.lng }], dark };
      segments.push(current);
    } else {
      current.points.push({ lat: place.lat, lng: place.lng });
    }
  }

  return segments;
}

/** Toll-plaza style fixes: sparser than the trace, and only where there is signal. */
export function pingFixes(
  trip: Trip,
  state: TripState,
  now: number,
  every = 8,
): LatLng[] {
  const route = routeFor(trip.laneId);
  const out: LatLng[] = [];
  timeline(trip, state, now, 80).forEach((at, i) => {
    if (i % every !== 0 || inGap(trip, at)) return;
    const place = placeOnRoute(route, progressAt(trip, at));
    out.push({ lat: place.lat, lng: place.lng });
  });
  return out;
}
