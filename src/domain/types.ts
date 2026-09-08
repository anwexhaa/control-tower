/* ============================================================================
   Domain model — Indian enterprise full-truckload freight.

   Named the way the industry names things, not the way a database would: an
   LR is a lorry receipt, an indent is a request for a vehicle, detention is
   time burnt at a gate. A controller reading this screen should recognise
   their own job in it.
   ========================================================================== */

export type Zone = "North" | "South" | "East" | "West" | "Central" | "North-East";

export type NodeType =
  | "plant"
  | "warehouse"
  | "cfs"
  | "port"
  | "depot";

/** A physical point freight moves between: plant, warehouse, port, depot. */
export interface FreightNode {
  code: string;
  name: string;
  state: string;
  stateCode: string;
  type: NodeType;
  zone: Zone;
  lat: number;
  lng: number;
}

/** A contracted corridor with a road distance and an agreed transit time. */
export interface Lane {
  id: string;
  originCode: string;
  destCode: string;
  /** Road distance, not great-circle — freight is billed on the road. */
  distanceKm: number;
  /** Contracted door-to-door transit, including statutory rest halts. */
  transitHours: number;
  /** Node codes the corridor runs through, used to shape the drawn route. */
  via: string[];
}

export type BodyType =
  | "closed"
  | "open"
  | "container"
  | "trailer"
  | "tanker"
  | "reefer"
  | "tipper";

/** Indian FTL vehicle classes, with the payloads the market actually books. */
export interface VehicleType {
  code: string;
  label: string;
  payloadMt: number;
  bodyType: BodyType;
  axles: number;
  /** Indicative all-in market rate per kilometre, in rupees. */
  ratePerKm: number;
}

export interface Transporter {
  code: string;
  name: string;
  fleetSize: number;
  zones: Zone[];
  /** Historic performance, used by Pulse and by the scorecard. */
  onTimePct: number;
  acceptancePct: number;
  rating: number;
}

export interface Driver {
  name: string;
  licenceNo: string;
  /** Masked at rest — a demo dataset has no business holding real numbers. */
  phoneMasked: string;
}

export interface Vehicle {
  regNo: string;
  typeCode: string;
  /** Telemetry source. Mixed fleets are the norm and drive EX-03 signal loss. */
  gpsProvider: "Fleetbeat" | "TrackMate" | "SIM-based" | "Transporter API";
}

export type Industry =
  | "FMCG"
  | "Chemicals"
  | "Tyres"
  | "Auto ancillary"
  | "Alcobev"
  | "Building materials";

export interface Commodity {
  code: string;
  name: string;
  industry: Industry;
  /** Light, bulky cargo cubes out before it weighs out. */
  bulky: boolean;
  reefer: boolean;
  hazardous: boolean;
}

/* ------------------------------------------------------------ lifecycle --- */

export const MILESTONE_SEQUENCE = [
  "indent_raised",
  "transporter_accepted",
  "vehicle_placed",
  "gate_in",
  "loading_complete",
  "gate_out",
  "in_transit",
  "arrived_destination",
  "unloading_complete",
  "pod_uploaded",
  "invoiced",
] as const;

export type MilestoneKey = (typeof MILESTONE_SEQUENCE)[number];

export const MILESTONE_LABEL: Record<MilestoneKey, string> = {
  indent_raised: "Indent raised",
  transporter_accepted: "Transporter accepted",
  vehicle_placed: "Vehicle placed",
  gate_in: "Gate-in at origin",
  loading_complete: "Loading complete",
  gate_out: "Gate-out / dispatch",
  in_transit: "In transit",
  arrived_destination: "Arrived at destination",
  unloading_complete: "Unloading complete",
  pod_uploaded: "POD uploaded",
  invoiced: "Invoiced",
};

export interface Milestone {
  key: MilestoneKey;
  plannedAt: number;
  /** null while the step has not happened yet. */
  actualAt: number | null;
}

/* ------------------------------------------------------------ exceptions --- */

export type ExceptionCode =
  | "EX-01"
  | "EX-02"
  | "EX-03"
  | "EX-04"
  | "EX-05"
  | "EX-06"
  | "EX-07"
  | "EX-08"
  | "EX-09"
  | "EX-10";

export type Severity = "low" | "medium" | "high" | "critical";

export interface TripException {
  id: string;
  code: ExceptionCode;
  severity: Severity;
  raisedAt: number;
  /** Set when a controller takes the exception. */
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
  snoozedUntil: number | null;
  resolvedAt: number | null;
  /** What the rule saw, in the units the controller thinks in. */
  detail: string;
}

/* ------------------------------------------------------------- documents --- */

export interface DocumentSet {
  lrNo: string;
  ewayBillNo: string;
  /** Rule 138 validity. Expiry with distance left to run is EX-07. */
  ewayValidUntil: number;
  ewayDistanceCoveredKm: number;
  invoiceNo: string;
  invoiceValueInr: number;
  weighbridgeSlipNo: string | null;
  /** Weighbridge tonnage against indented tonnage feeds EX-10. */
  weighedMt: number | null;
  podUploadedAt: number | null;
}

/* ------------------------------------------------------------------ trip --- */

export type TripStatus = "planned" | "in_transit" | "at_risk" | "delivered";

export interface Trip {
  id: string;
  laneId: string;
  transporterCode: string;
  commodityCode: string;
  vehicle: Vehicle;
  driver: Driver;

  status: TripStatus;
  /** Fraction of the lane covered, 0–1. Position is derived from this. */
  progress: number;

  weightMt: number;
  freightInr: number;

  indentedAt: number;
  dispatchedAt: number | null;
  /** The promised delivery moment the SLA is measured against. */
  slaCommitAt: number;
  /** Current projection. Re-derived every tick once phase 2 lands. */
  etaAt: number;
  deliveredAt: number | null;

  lastPingAt: number;
  /** Halted time at origin and destination gates, in hours. */
  detentionOriginH: number;
  detentionDestH: number;

  milestones: Milestone[];
  exceptions: TripException[];
  docs: DocumentSet;
}

/** The generated snapshot the whole app reads from. */
export interface Network {
  seed: number;
  /** Simulation "now" the snapshot was built against. */
  now: number;
  trips: Trip[];
  byId: Map<string, Trip>;
}
