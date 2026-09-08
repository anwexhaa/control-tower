import { nodeName } from "./nodes";
import type { Lane } from "./types";

/* 45 corridors an Indian manufacturer would actually contract.

   `distanceKm` is road distance — freight is billed on the road, not on the
   great circle, and the gap is large in India (Bhiwandi to Bengaluru is 985 km
   by road against roughly 840 as the crow flies).

   `transitHours` is the contracted door-to-door SLA, which averages out near
   23 km/h once statutory rest halts, checkposts and city entry restrictions
   are counted. Short hauls run slower per kilometre because gate time is a
   bigger share of the trip. `via` shapes the drawn route in phase 3. */

function lane(
  originCode: string,
  destCode: string,
  distanceKm: number,
  transitHours: number,
  via: string[] = [],
): Lane {
  return { id: `${originCode}-${destCode}`, originCode, destCode, distanceKm, transitHours, via };
}

export const LANES: Lane[] = [
  // West ↔ South
  lane("BHW", "BLR", 985, 42, ["PNQ", "KLP", "BLG", "HBL"]),
  lane("BHW", "HYD", 710, 30, ["PNQ"]),
  lane("PNQ", "BLR", 840, 36, ["KLP", "BLG", "HBL"]),
  lane("PNQ", "HYD", 560, 24, []),
  lane("HSR", "BHW", 1010, 44, ["BLR", "HBL", "BLG", "KLP", "PNQ"]),

  // West internal — the chemical belt and the Mumbai warehousing cluster
  lane("DHJ", "BHW", 385, 18, ["ANK", "VAP"]),
  lane("DHJ", "ANK", 55, 3, []),
  lane("ANK", "BHW", 340, 16, ["VAP"]),
  lane("VAP", "BHW", 175, 9, []),
  lane("SND", "BHW", 545, 24, ["AMD", "HZR", "VAP"]),
  lane("BHW", "AMD", 520, 22, ["VAP", "HZR"]),
  lane("NSK", "BHW", 165, 8, []),
  lane("ABD", "BHW", 340, 15, ["NSK"]),
  lane("HLL", "BHW", 480, 21, ["HZR", "VAP"]),
  lane("VER", "BHW", 590, 26, ["KLP"]),

  // West ↔ North
  lane("BHW", "DEL", 1400, 58, ["HZR", "AMD", "JAI"]),
  lane("GGN", "PNQ", 1430, 60, ["JAI", "AMD", "HZR", "BHW"]),
  lane("GGN", "BHW", 1390, 58, ["JAI", "AMD", "HZR"]),
  lane("BWL", "BHW", 1340, 56, ["JAI", "AMD", "HZR"]),
  lane("MNS", "SND", 900, 38, ["JAI", "AMD"]),
  lane("JAI", "BHW", 1180, 50, ["AMD", "HZR"]),
  lane("LDH", "BHW", 1630, 68, ["DEL", "JAI", "AMD"]),
  lane("MUN", "LDH", 1280, 54, ["JAI", "DEL"]),
  lane("SND", "PNT", 1250, 54, ["AMD", "JAI", "DEL"]),

  // North internal
  lane("LDH", "DEL", 310, 14, []),
  lane("BDI", "DEL", 330, 15, []),
  lane("PNT", "LKO", 380, 18, []),
  lane("HDW", "LKO", 550, 24, []),
  lane("KNP", "DEL", 490, 21, ["AGR"]),
  lane("NOI", "JAI", 280, 13, []),
  lane("BHG", "LKO", 530, 23, ["AGR"]),
  lane("ASR", "DEL", 450, 20, ["JLD", "LDH"]),

  // North / Central ↔ South & East
  lane("MNS", "MAA", 2180, 88, ["AGR", "BPL", "NAG", "HYD"]),
  lane("BDI", "CCU", 1720, 74, ["DEL", "LKO", "VNS", "PAT"]),
  lane("HDW", "GAU", 1780, 78, ["LKO", "PAT", "SLG"]),
  lane("IDR", "BHW", 590, 26, ["NSK"]),
  lane("PTM", "PNQ", 585, 26, ["NSK"]),
  lane("RPR", "NAG", 290, 13, []),
  lane("BHW", "NAG", 780, 32, ["NSK", "ABD"]),

  // South internal
  lane("HSR", "MAA", 305, 14, []),
  lane("SPD", "BLR", 320, 15, []),
  lane("BLR", "MAA", 350, 15, ["HSR"]),
  lane("BLR", "HYD", 570, 24, []),
  lane("BLR", "COK", 550, 26, ["CBE"]),
  lane("MAA", "HYD", 630, 27, ["VJA"]),
  lane("HYD", "VTZ", 620, 28, ["VJA"]),
  lane("SRC", "BLR", 300, 14, []),
  lane("COK", "CBE", 190, 9, []),
  lane("MDU", "MAA", 460, 20, []),

  // East
  lane("MAA", "CCU", 1670, 70, ["VJA", "VTZ", "BBI"]),
  lane("JSR", "MAA", 1650, 70, ["BBI", "VTZ", "VJA"]),
  lane("JSR", "CCU", 300, 14, []),
  lane("CCU", "GAU", 1020, 46, ["SLG"]),
  lane("CCU", "PAT", 590, 26, []),
  lane("BBI", "CCU", 440, 20, []),
  lane("RKL", "BHI", 480, 22, []),
  lane("PRD", "RPR", 700, 30, ["BBI"]),
  lane("HLD", "CCU", 125, 7, []),
];

export const LANE_BY_ID: ReadonlyMap<string, Lane> = new Map(
  LANES.map((l) => [l.id, l]),
);

/** "Bhiwandi → Bengaluru" */
export function laneLabel(lane: Lane): string {
  return `${nodeName(lane.originCode)} → ${nodeName(lane.destCode)}`;
}

/** Billed tonne-kilometres, the unit freight performance is reported in. */
export function btkm(weightMt: number, distanceKm: number): number {
  return weightMt * distanceKm;
}
