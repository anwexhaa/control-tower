import { commodityName } from "../../domain/commodities";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { NODE_BY_CODE } from "../../domain/nodes";
import { transporterName } from "../../domain/transporters";
import { vehicleLabel } from "../../domain/fleet";
import type {
  ExceptionCode,
  Severity,
  Trip,
  TripState,
  TripStatus,
  Zone,
} from "../../domain/types";

/* ============================================================================
   One filter object, read by the map, the queue, the table and the KPI strip.

   The four panes cannot disagree about what the user is looking at, because
   there is nothing for them to disagree with — they all call `matchTrip`
   against the same value. Every dimension composes: lane AND severity AND
   transporter AND free text, all at once.
   ========================================================================== */

export interface TripFilter {
  /** Free text over LR, vehicle, transporter, lane, driver, commodity. */
  query: string;
  statuses: TripStatus[];
  severities: Severity[];
  codes: ExceptionCode[];
  laneIds: string[];
  transporterCodes: string[];
  zones: Zone[];
  /** Only trips carrying at least one open exception. */
  withExceptions: boolean;
}

export const EMPTY_FILTER: TripFilter = {
  query: "",
  statuses: [],
  severities: [],
  codes: [],
  laneIds: [],
  transporterCodes: [],
  zones: [],
  withExceptions: false,
};

export function isFilterActive(f: TripFilter): boolean {
  return (
    f.query.trim() !== "" ||
    f.statuses.length > 0 ||
    f.severities.length > 0 ||
    f.codes.length > 0 ||
    f.laneIds.length > 0 ||
    f.transporterCodes.length > 0 ||
    f.zones.length > 0 ||
    f.withExceptions
  );
}

export function countActiveDimensions(f: TripFilter): number {
  let n = 0;
  if (f.query.trim()) n++;
  if (f.statuses.length) n++;
  if (f.severities.length) n++;
  if (f.codes.length) n++;
  if (f.laneIds.length) n++;
  if (f.transporterCodes.length) n++;
  if (f.zones.length) n++;
  if (f.withExceptions) n++;
  return n;
}

/* ---------------------------------------------------------- search index --- */

/* Trips are static for the life of the page, so the haystack is built once
   and cached against the array identity rather than rebuilt on every keystroke. */

const indexCache = new WeakMap<readonly Trip[], Map<string, string>>();

function searchIndex(trips: readonly Trip[]): Map<string, string> {
  const cached = indexCache.get(trips);
  if (cached) return cached;

  const index = new Map<string, string>();
  for (const t of trips) {
    const lane = LANE_BY_ID.get(t.laneId);
    index.set(
      t.id,
      [
        t.docs.lrNo,
        t.vehicle.regNo,
        vehicleLabel(t.vehicle.typeCode),
        transporterName(t.transporterCode),
        lane ? laneLabel(lane) : t.laneId,
        commodityName(t.commodityCode),
        t.driver.name,
        t.docs.invoiceNo,
      ]
        .join(" ")
        .toLowerCase(),
    );
  }
  indexCache.set(trips, index);
  return index;
}

/** Zone of a trip's origin and destination, for the zone filter. */
const zoneCache = new WeakMap<readonly Trip[], Map<string, Zone[]>>();

function zonesOf(trips: readonly Trip[]): Map<string, Zone[]> {
  const cached = zoneCache.get(trips);
  if (cached) return cached;

  const map = new Map<string, Zone[]>();
  for (const t of trips) {
    const lane = LANE_BY_ID.get(t.laneId);
    const o = lane ? NODE_BY_CODE.get(lane.originCode) : undefined;
    const d = lane ? NODE_BY_CODE.get(lane.destCode) : undefined;
    const zones: Zone[] = [];
    if (o) zones.push(o.zone);
    if (d && (!o || d.zone !== o.zone)) zones.push(d.zone);
    map.set(t.id, zones);
  }
  zoneCache.set(trips, map);
  return map;
}

/* ----------------------------------------------------------------- match --- */

export function matchTrip(
  trip: Trip,
  state: TripState | undefined,
  filter: TripFilter,
  haystack: Map<string, string>,
  zones: Map<string, Zone[]>,
): boolean {
  if (!state) return false;

  if (filter.statuses.length && !filter.statuses.includes(state.status)) return false;

  if (filter.laneIds.length && !filter.laneIds.includes(trip.laneId)) return false;

  if (filter.transporterCodes.length && !filter.transporterCodes.includes(trip.transporterCode)) {
    return false;
  }

  if (filter.zones.length) {
    const tripZones = zones.get(trip.id) ?? [];
    if (!tripZones.some((z) => filter.zones.includes(z))) return false;
  }

  const needsException =
    filter.withExceptions || filter.severities.length > 0 || filter.codes.length > 0;

  if (needsException) {
    let ok = false;
    for (const e of state.exceptions) {
      if (e.resolvedAt !== null) continue;
      if (filter.severities.length && !filter.severities.includes(e.severity)) continue;
      if (filter.codes.length && !filter.codes.includes(e.code)) continue;
      ok = true;
      break;
    }
    if (!ok) return false;
  }

  const q = filter.query.trim().toLowerCase();
  if (q) {
    const hay = haystack.get(trip.id);
    if (!hay) return false;
    // Every whitespace-separated term must appear, so "sharda bhiwandi"
    // narrows rather than widening.
    for (const term of q.split(/\s+/)) {
      if (!hay.includes(term)) return false;
    }
  }

  return true;
}

export function applyFilter(
  trips: readonly Trip[],
  states: ReadonlyMap<string, TripState>,
  filter: TripFilter,
): Trip[] {
  if (!isFilterActive(filter)) return trips as Trip[];

  const haystack = searchIndex(trips);
  const zones = zonesOf(trips);
  const out: Trip[] = [];
  for (const t of trips) {
    if (matchTrip(t, states.get(t.id), filter, haystack, zones)) out.push(t);
  }
  return out;
}

/* ------------------------------------------------------------------ chips --- */

export interface FilterChip {
  key: string;
  label: string;
  clear: (f: TripFilter) => TripFilter;
}

const STATUS_TEXT: Record<TripStatus, string> = {
  planned: "Not started",
  in_transit: "In transit",
  at_risk: "At risk",
  delivered: "Delivered",
};

/** The active filter, rendered as removable chips. */
export function describeFilter(f: TripFilter): FilterChip[] {
  const chips: FilterChip[] = [];

  if (f.query.trim()) {
    chips.push({
      key: "query",
      label: `“${f.query.trim()}”`,
      clear: (x) => ({ ...x, query: "" }),
    });
  }
  for (const s of f.statuses) {
    chips.push({
      key: `status:${s}`,
      label: STATUS_TEXT[s],
      clear: (x) => ({ ...x, statuses: x.statuses.filter((v) => v !== s) }),
    });
  }
  for (const s of f.severities) {
    chips.push({
      key: `sev:${s}`,
      label: `${s} severity`,
      clear: (x) => ({ ...x, severities: x.severities.filter((v) => v !== s) }),
    });
  }
  for (const c of f.codes) {
    chips.push({
      key: `code:${c}`,
      label: c,
      clear: (x) => ({ ...x, codes: x.codes.filter((v) => v !== c) }),
    });
  }
  for (const id of f.laneIds) {
    const lane = LANE_BY_ID.get(id);
    chips.push({
      key: `lane:${id}`,
      label: lane ? laneLabel(lane) : id,
      clear: (x) => ({ ...x, laneIds: x.laneIds.filter((v) => v !== id) }),
    });
  }
  for (const code of f.transporterCodes) {
    chips.push({
      key: `tp:${code}`,
      label: transporterName(code),
      clear: (x) => ({
        ...x,
        transporterCodes: x.transporterCodes.filter((v) => v !== code),
      }),
    });
  }
  for (const z of f.zones) {
    chips.push({
      key: `zone:${z}`,
      label: `${z} zone`,
      clear: (x) => ({ ...x, zones: x.zones.filter((v) => v !== z) }),
    });
  }
  if (f.withExceptions) {
    chips.push({
      key: "withExceptions",
      label: "Has exception",
      clear: (x) => ({ ...x, withExceptions: false }),
    });
  }

  return chips;
}

/* ---------------------------------------------------------------- sorting --- */

export type SortKey =
  | "lr"
  | "lane"
  | "transporter"
  | "progress"
  | "speed"
  | "status"
  | "eta"
  | "delay"
  | "ping";

export interface Sort {
  key: SortKey;
  direction: "asc" | "desc";
}

const STATUS_ORDER: Record<TripStatus, number> = {
  at_risk: 0,
  in_transit: 1,
  planned: 2,
  delivered: 3,
};

export function sortTrips(
  trips: Trip[],
  states: ReadonlyMap<string, TripState>,
  sort: Sort | null,
): Trip[] {
  if (!sort) return trips;
  const dir = sort.direction === "asc" ? 1 : -1;

  const value = (t: Trip): number | string => {
    const s = states.get(t.id);
    switch (sort.key) {
      case "lr": return t.docs.lrNo;
      case "lane": return LANE_BY_ID.get(t.laneId) ? laneLabel(LANE_BY_ID.get(t.laneId)!) : t.laneId;
      case "transporter": return transporterName(t.transporterCode);
      case "progress": return s?.progress ?? -1;
      case "speed": return s?.speedKmph ?? -1;
      case "status": return s ? STATUS_ORDER[s.status] : 99;
      case "eta": return s?.etaAt ?? 0;
      case "delay": return s?.delayHours ?? -1;
      case "ping": return s?.lastPingAt ?? 0;
    }
  };

  // Copy first: the caller's array is the filtered result, and sorting in
  // place would quietly reorder memoised state elsewhere.
  return [...trips].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * dir;
    }
    return (va - vb) * dir;
  });
}
