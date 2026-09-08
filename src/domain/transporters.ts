import type { Transporter } from "./types";

/* Fictional carriers. Named after rivers, ranges and regions the way Indian
   road transport companies usually are, but invented — no real operator is
   depicted here, and the performance figures are generated, not reported. */

export const TRANSPORTERS: Transporter[] = [
  { code: "SHR", name: "Sharda Roadlines",     fleetSize: 412, zones: ["West", "South"],            onTimePct: 91.2, acceptancePct: 96.1, rating: 4.4 },
  { code: "DCC", name: "Deccan Carriers",      fleetSize: 386, zones: ["South", "West"],            onTimePct: 88.7, acceptancePct: 93.4, rating: 4.1 },
  { code: "NRM", name: "Narmada Logistics",    fleetSize: 298, zones: ["West", "Central"],          onTimePct: 84.3, acceptancePct: 90.2, rating: 3.7 },
  { code: "KVR", name: "Kaveri Transport",     fleetSize: 341, zones: ["South"],                    onTimePct: 93.5, acceptancePct: 97.0, rating: 4.6 },
  { code: "VDH", name: "Vindhya Freight",      fleetSize: 224, zones: ["Central", "North"],         onTimePct: 79.8, acceptancePct: 86.5, rating: 3.3 },
  { code: "STL", name: "Sutlej Carriers",      fleetSize: 267, zones: ["North"],                    onTimePct: 89.9, acceptancePct: 94.8, rating: 4.2 },
  { code: "KNK", name: "Konkan Roadways",      fleetSize: 189, zones: ["West"],                     onTimePct: 86.1, acceptancePct: 91.7, rating: 3.9 },
  { code: "ARV", name: "Aravalli Transport",   fleetSize: 305, zones: ["North", "West"],            onTimePct: 82.6, acceptancePct: 88.9, rating: 3.5 },
  { code: "GDV", name: "Godavari Logistics",   fleetSize: 358, zones: ["South", "East"],            onTimePct: 90.4, acceptancePct: 95.2, rating: 4.3 },
  { code: "CHM", name: "Chambal Carriers",     fleetSize: 176, zones: ["North", "Central"],         onTimePct: 77.2, acceptancePct: 84.1, rating: 3.1 },
  { code: "MLW", name: "Malwa Roadlines",      fleetSize: 213, zones: ["Central", "West"],          onTimePct: 85.5, acceptancePct: 92.3, rating: 3.8 },
  { code: "PLR", name: "Palar Freight Lines",  fleetSize: 244, zones: ["South"],                    onTimePct: 92.1, acceptancePct: 95.9, rating: 4.5 },
  { code: "STP", name: "Satpura Transport",    fleetSize: 158, zones: ["Central"],                  onTimePct: 80.7, acceptancePct: 87.4, rating: 3.4 },
  { code: "BGR", name: "Bhagirathi Logistics", fleetSize: 291, zones: ["East", "North"],            onTimePct: 87.3, acceptancePct: 92.8, rating: 4.0 },
  { code: "NLG", name: "Nilgiri Carriers",     fleetSize: 202, zones: ["South", "West"],            onTimePct: 88.0, acceptancePct: 93.1, rating: 4.0 },
  { code: "SRT", name: "Saurashtra Roadlines", fleetSize: 327, zones: ["West", "North"],            onTimePct: 83.9, acceptancePct: 89.6, rating: 3.6 },
  { code: "DAB", name: "Doab Transport",       fleetSize: 185, zones: ["North"],                    onTimePct: 81.4, acceptancePct: 87.9, rating: 3.4 },
  { code: "VDB", name: "Vidarbha Freight",     fleetSize: 168, zones: ["Central", "East"],          onTimePct: 78.6, acceptancePct: 85.3, rating: 3.2 },
  { code: "KLG", name: "Kalinga Carriers",     fleetSize: 236, zones: ["East"],                     onTimePct: 86.8, acceptancePct: 91.2, rating: 3.9 },
  { code: "RHK", name: "Rohilkhand Logistics", fleetSize: 149, zones: ["North", "North-East"],      onTimePct: 75.9, acceptancePct: 82.7, rating: 3.0 },
];

export const TRANSPORTER_BY_CODE: ReadonlyMap<string, Transporter> = new Map(
  TRANSPORTERS.map((t) => [t.code, t]),
);

export function transporterName(code: string): string {
  return TRANSPORTER_BY_CODE.get(code)?.name ?? code;
}

/* Driver name pools, used to build plausible crew records. Combined at random
   by the seeded generator; no individual is depicted. */

export const DRIVER_FIRST_NAMES = [
  "Ramesh", "Suresh", "Mahesh", "Vijay", "Anil", "Sunil", "Rajesh", "Dinesh",
  "Prakash", "Santosh", "Manoj", "Ganesh", "Naresh", "Mukesh", "Ashok",
  "Balwinder", "Gurpreet", "Harjeet", "Jaspal", "Kuldeep",
  "Murugan", "Selvam", "Ravi", "Karthik", "Arun", "Venkatesh", "Srinivas",
  "Ibrahim", "Salim", "Rafiq", "Iqbal", "Yusuf",
  "Bhaskar", "Pradeep", "Shankar", "Deepak", "Vinod", "Sanjay", "Rakesh",
];

export const DRIVER_LAST_NAMES = [
  "Yadav", "Kumar", "Singh", "Sharma", "Verma", "Patil", "Jadhav", "Shinde",
  "Gowda", "Reddy", "Naidu", "Rao", "Nair", "Menon", "Pillai",
  "Chauhan", "Rathore", "Solanki", "Parmar", "Desai", "Patel",
  "Mandal", "Das", "Ghosh", "Barman", "Mahato",
  "Khan", "Ansari", "Sheikh", "Qureshi",
];
