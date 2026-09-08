import type { Commodity } from "./types";

/* What actually rides on these lanes. The flags matter operationally:
   `bulky` cargo cubes out the deck before it weighs out, so the truck runs
   under its rated payload; `reefer` cargo raises EX-09 temperature excursions;
   `hazardous` cargo carries licensing and route restrictions. */

export const COMMODITIES: Commodity[] = [
  // FMCG
  { code: "FMC-DET", name: "Detergent cases",        industry: "FMCG",              bulky: true,  reefer: false, hazardous: false },
  { code: "FMC-BEV", name: "Packaged beverages",     industry: "FMCG",              bulky: false, reefer: false, hazardous: false },
  { code: "FMC-SNK", name: "Snacks & confectionery", industry: "FMCG",              bulky: true,  reefer: false, hazardous: false },
  { code: "FMC-EDO", name: "Edible oil (packed)",    industry: "FMCG",              bulky: false, reefer: false, hazardous: false },
  { code: "FMC-DRY", name: "Dairy — chilled",        industry: "FMCG",              bulky: false, reefer: true,  hazardous: false },
  { code: "FMC-FRZ", name: "Frozen foods",           industry: "FMCG",              bulky: false, reefer: true,  hazardous: false },

  // Chemicals
  { code: "CHM-SOL", name: "Industrial solvents",    industry: "Chemicals",         bulky: false, reefer: false, hazardous: true },
  { code: "CHM-CAU", name: "Caustic soda lye",       industry: "Chemicals",         bulky: false, reefer: false, hazardous: true },
  { code: "CHM-RES", name: "Polymer resins",         industry: "Chemicals",         bulky: false, reefer: false, hazardous: false },
  { code: "CHM-DYE", name: "Dyes & intermediates",   industry: "Chemicals",         bulky: false, reefer: false, hazardous: true },
  { code: "CHM-FRT", name: "Speciality fertiliser",  industry: "Chemicals",         bulky: false, reefer: false, hazardous: false },

  // Tyres
  { code: "TYR-TBR", name: "Truck & bus radials",    industry: "Tyres",             bulky: true,  reefer: false, hazardous: false },
  { code: "TYR-PCR", name: "Passenger car radials",  industry: "Tyres",             bulky: true,  reefer: false, hazardous: false },
  { code: "TYR-RUB", name: "Natural rubber bales",   industry: "Tyres",             bulky: false, reefer: false, hazardous: false },

  // Auto ancillary
  { code: "AUT-CMP", name: "Auto components",        industry: "Auto ancillary",    bulky: false, reefer: false, hazardous: false },
  { code: "AUT-SHT", name: "Sheet metal pressings",  industry: "Auto ancillary",    bulky: true,  reefer: false, hazardous: false },
  { code: "AUT-BAT", name: "Lead-acid batteries",    industry: "Auto ancillary",    bulky: false, reefer: false, hazardous: true },
  { code: "AUT-GLS", name: "Automotive glass",       industry: "Auto ancillary",    bulky: true,  reefer: false, hazardous: false },

  // Alcobev
  { code: "ALC-BER", name: "Beer — cases",           industry: "Alcobev",           bulky: false, reefer: false, hazardous: false },
  { code: "ALC-SPR", name: "Spirits — cases",        industry: "Alcobev",           bulky: false, reefer: false, hazardous: false },
  { code: "ALC-ENA", name: "Extra neutral alcohol",  industry: "Alcobev",           bulky: false, reefer: false, hazardous: true },

  // Building materials
  { code: "BLD-CEM", name: "Cement bags",            industry: "Building materials", bulky: false, reefer: false, hazardous: false },
  { code: "BLD-TIL", name: "Ceramic tiles",          industry: "Building materials", bulky: false, reefer: false, hazardous: false },
  { code: "BLD-STL", name: "TMT bars",               industry: "Building materials", bulky: false, reefer: false, hazardous: false },
];

export const COMMODITY_BY_CODE: ReadonlyMap<string, Commodity> = new Map(
  COMMODITIES.map((c) => [c.code, c]),
);

export function commodityName(code: string): string {
  return COMMODITY_BY_CODE.get(code)?.name ?? code;
}

/** Vehicle classes a commodity can legitimately move on. */
export function eligibleVehicleCodes(c: Commodity): string[] {
  if (c.reefer) return ["REF20"];
  if (c.code === "CHM-CAU" || c.code === "CHM-SOL" || c.code === "ALC-ENA") {
    return ["TNK20"];
  }
  if (c.code === "BLD-CEM" || c.code === "BLD-STL") {
    return ["TRL24", "TRL28", "TRL32", "TIP16"];
  }
  if (c.bulky) return ["SXL32", "MXL32", "CNT22", "CNT20"];
  return ["MXL32", "SXL32", "CNT22", "TRL24", "TRL28"];
}
