import type { VehicleType } from "./types";

/* Indian FTL vehicle classes with the payloads the market actually books.

   SXL and MXL are the standard 32-foot single- and multi-axle rigids: same
   deck length, very different rated payload, and confusing them is how a
   dispatch goes wrong. Rates are indicative all-in market rates per kilometre
   in rupees, before lane and season variance. */

export const VEHICLE_TYPES: VehicleType[] = [
  { code: "LCV14", label: "14 ft LCV",       payloadMt: 3.5, bodyType: "closed",    axles: 2, ratePerKm: 28 },
  { code: "LCV19", label: "19 ft LCV",       payloadMt: 6,   bodyType: "closed",    axles: 2, ratePerKm: 34 },
  { code: "CNT20", label: "20 ft container", payloadMt: 7,   bodyType: "container", axles: 2, ratePerKm: 38 },
  { code: "CNT22", label: "22 ft container", payloadMt: 10,  bodyType: "container", axles: 2, ratePerKm: 44 },
  { code: "SXL32", label: "32 ft SXL",       payloadMt: 9,   bodyType: "closed",    axles: 2, ratePerKm: 48 },
  { code: "MXL32", label: "32 ft MXL",       payloadMt: 15,  bodyType: "closed",    axles: 3, ratePerKm: 54 },
  { code: "TRL24", label: "24 MT trailer",   payloadMt: 24,  bodyType: "trailer",   axles: 4, ratePerKm: 58 },
  { code: "TRL28", label: "28 MT trailer",   payloadMt: 28,  bodyType: "trailer",   axles: 5, ratePerKm: 64 },
  { code: "TRL32", label: "32 MT trailer",   payloadMt: 32,  bodyType: "trailer",   axles: 6, ratePerKm: 70 },
  { code: "REF20", label: "20 ft reefer",    payloadMt: 8,   bodyType: "reefer",    axles: 2, ratePerKm: 62 },
  { code: "TNK20", label: "20 KL tanker",    payloadMt: 18,  bodyType: "tanker",    axles: 3, ratePerKm: 60 },
  { code: "TIP16", label: "16 MT tipper",    payloadMt: 16,  bodyType: "tipper",    axles: 3, ratePerKm: 46 },
];

export const VEHICLE_BY_CODE: ReadonlyMap<string, VehicleType> = new Map(
  VEHICLE_TYPES.map((v) => [v.code, v]),
);

export function vehicleLabel(code: string): string {
  return VEHICLE_BY_CODE.get(code)?.label ?? code;
}

/* RTO series used to build plausible registration numbers. Real format is
   state code, two-digit RTO district, a one- or two-letter series, four
   digits — MH-04-KL-8821. */
export const RTO_DISTRICTS: Record<string, string[]> = {
  MH: ["01", "02", "04", "12", "14", "43", "48"],
  GJ: ["01", "05", "06", "16", "18", "27"],
  HR: ["26", "29", "38", "55", "72"],
  DL: ["01", "03", "09", "13"],
  PB: ["10", "11", "65"],
  RJ: ["02", "14", "27", "45"],
  UP: ["14", "16", "32", "78", "80"],
  UK: ["04", "06", "07"],
  MP: ["04", "09", "20", "41"],
  CG: ["04", "07", "10"],
  KA: ["01", "02", "05", "25", "51"],
  TN: ["09", "10", "20", "29", "45"],
  TG: ["07", "09", "11", "13"],
  AP: ["16", "28", "31", "39"],
  KL: ["01", "07", "41"],
  WB: ["11", "23", "25", "37"],
  JH: ["05", "10", "22"],
  OD: ["02", "05", "14", "33"],
  BR: ["01", "06", "31"],
  AS: ["01", "25"],
  HP: ["12", "40", "72"],
  GA: ["01", "07"],
};

export const GPS_PROVIDERS = [
  "Fleetbeat",
  "TrackMate",
  "SIM-based",
  "Transporter API",
] as const;
