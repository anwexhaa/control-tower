import type { FreightNode } from "./types";

/* Real Indian freight nodes with real coordinates: the manufacturing clusters,
   warehousing hubs and gateway ports that enterprise FTL actually runs between.
   Bhiwandi is the country's largest warehousing cluster, Dahej and Ankleshwar
   are the chemical belt, Hosur and Sriperumbudur are the southern auto belt,
   Baddi is the excise-driven pharma/FMCG cluster. */

export const NODES: FreightNode[] = [
  // ------------------------------------------------------------------ West
  { code: "BHW", name: "Bhiwandi", state: "Maharashtra", stateCode: "MH", type: "warehouse", zone: "West", lat: 19.2967, lng: 73.0631 },
  { code: "JNP", name: "Nhava Sheva (JNPT)", state: "Maharashtra", stateCode: "MH", type: "port", zone: "West", lat: 18.9490, lng: 72.9525 },
  { code: "CKN", name: "Chakan", state: "Maharashtra", stateCode: "MH", type: "plant", zone: "West", lat: 18.7606, lng: 73.8636 },
  { code: "PNQ", name: "Pune", state: "Maharashtra", stateCode: "MH", type: "warehouse", zone: "West", lat: 18.5204, lng: 73.8567 },
  { code: "NAG", name: "Nagpur", state: "Maharashtra", stateCode: "MH", type: "depot", zone: "Central", lat: 21.1458, lng: 79.0882 },
  { code: "ABD", name: "Aurangabad", state: "Maharashtra", stateCode: "MH", type: "plant", zone: "West", lat: 19.8762, lng: 75.3433 },
  { code: "NSK", name: "Nashik", state: "Maharashtra", stateCode: "MH", type: "plant", zone: "West", lat: 19.9975, lng: 73.7898 },
  { code: "KLP", name: "Kolhapur", state: "Maharashtra", stateCode: "MH", type: "depot", zone: "West", lat: 16.7050, lng: 74.2433 },
  { code: "VER", name: "Verna", state: "Goa", stateCode: "GA", type: "plant", zone: "West", lat: 15.3600, lng: 73.9400 },

  { code: "DHJ", name: "Dahej", state: "Gujarat", stateCode: "GJ", type: "port", zone: "West", lat: 21.7051, lng: 72.5900 },
  { code: "ANK", name: "Ankleshwar", state: "Gujarat", stateCode: "GJ", type: "plant", zone: "West", lat: 21.6279, lng: 73.0143 },
  { code: "VAP", name: "Vapi", state: "Gujarat", stateCode: "GJ", type: "plant", zone: "West", lat: 20.3893, lng: 72.9106 },
  { code: "SND", name: "Sanand", state: "Gujarat", stateCode: "GJ", type: "plant", zone: "West", lat: 22.9800, lng: 72.3800 },
  { code: "AMD", name: "Ahmedabad", state: "Gujarat", stateCode: "GJ", type: "warehouse", zone: "West", lat: 23.0225, lng: 72.5714 },
  { code: "MUN", name: "Mundra", state: "Gujarat", stateCode: "GJ", type: "port", zone: "West", lat: 22.8394, lng: 69.7219 },
  { code: "HZR", name: "Hazira", state: "Gujarat", stateCode: "GJ", type: "port", zone: "West", lat: 21.1000, lng: 72.6500 },
  { code: "HLL", name: "Halol", state: "Gujarat", stateCode: "GJ", type: "plant", zone: "West", lat: 22.5024, lng: 73.4707 },
  { code: "RJK", name: "Rajkot", state: "Gujarat", stateCode: "GJ", type: "depot", zone: "West", lat: 22.3039, lng: 70.8022 },

  // ----------------------------------------------------------------- North
  { code: "GGN", name: "Gurugram", state: "Haryana", stateCode: "HR", type: "warehouse", zone: "North", lat: 28.4595, lng: 77.0266 },
  { code: "MNS", name: "Manesar", state: "Haryana", stateCode: "HR", type: "plant", zone: "North", lat: 28.3549, lng: 76.9366 },
  { code: "BWL", name: "Bawal", state: "Haryana", stateCode: "HR", type: "plant", zone: "North", lat: 28.0714, lng: 76.5836 },
  { code: "FBD", name: "Faridabad", state: "Haryana", stateCode: "HR", type: "plant", zone: "North", lat: 28.4089, lng: 77.3178 },
  { code: "BHG", name: "Bahadurgarh", state: "Haryana", stateCode: "HR", type: "warehouse", zone: "North", lat: 28.6926, lng: 76.9339 },
  { code: "DEL", name: "Delhi", state: "Delhi", stateCode: "DL", type: "depot", zone: "North", lat: 28.6139, lng: 77.2090 },
  { code: "NOI", name: "Noida", state: "Uttar Pradesh", stateCode: "UP", type: "plant", zone: "North", lat: 28.5355, lng: 77.3910 },

  { code: "LDH", name: "Ludhiana", state: "Punjab", stateCode: "PB", type: "plant", zone: "North", lat: 30.9010, lng: 75.8573 },
  { code: "JLD", name: "Jalandhar", state: "Punjab", stateCode: "PB", type: "depot", zone: "North", lat: 31.3260, lng: 75.5762 },
  { code: "ASR", name: "Amritsar", state: "Punjab", stateCode: "PB", type: "depot", zone: "North", lat: 31.6340, lng: 74.8723 },
  { code: "BDI", name: "Baddi", state: "Himachal Pradesh", stateCode: "HP", type: "plant", zone: "North", lat: 30.9578, lng: 76.7914 },

  { code: "JAI", name: "Jaipur", state: "Rajasthan", stateCode: "RJ", type: "warehouse", zone: "North", lat: 26.9124, lng: 75.7873 },
  { code: "BWD", name: "Bhiwadi", state: "Rajasthan", stateCode: "RJ", type: "plant", zone: "North", lat: 28.2100, lng: 76.8600 },
  { code: "NMR", name: "Neemrana", state: "Rajasthan", stateCode: "RJ", type: "plant", zone: "North", lat: 27.9880, lng: 76.3860 },
  { code: "JDH", name: "Jodhpur", state: "Rajasthan", stateCode: "RJ", type: "depot", zone: "North", lat: 26.2389, lng: 73.0243 },

  { code: "PNT", name: "Pantnagar", state: "Uttarakhand", stateCode: "UK", type: "plant", zone: "North", lat: 29.0222, lng: 79.4908 },
  { code: "HDW", name: "Haridwar", state: "Uttarakhand", stateCode: "UK", type: "plant", zone: "North", lat: 29.9457, lng: 78.1642 },
  { code: "LKO", name: "Lucknow", state: "Uttar Pradesh", stateCode: "UP", type: "warehouse", zone: "North", lat: 26.8467, lng: 80.9462 },
  { code: "KNP", name: "Kanpur", state: "Uttar Pradesh", stateCode: "UP", type: "plant", zone: "North", lat: 26.4499, lng: 80.3319 },
  { code: "AGR", name: "Agra", state: "Uttar Pradesh", stateCode: "UP", type: "depot", zone: "North", lat: 27.1767, lng: 78.0081 },
  { code: "VNS", name: "Varanasi", state: "Uttar Pradesh", stateCode: "UP", type: "depot", zone: "North", lat: 25.3176, lng: 82.9739 },

  // --------------------------------------------------------------- Central
  { code: "PTM", name: "Pithampur", state: "Madhya Pradesh", stateCode: "MP", type: "plant", zone: "Central", lat: 22.6013, lng: 75.6890 },
  { code: "IDR", name: "Indore", state: "Madhya Pradesh", stateCode: "MP", type: "warehouse", zone: "Central", lat: 22.7196, lng: 75.8577 },
  { code: "BPL", name: "Bhopal", state: "Madhya Pradesh", stateCode: "MP", type: "depot", zone: "Central", lat: 23.2599, lng: 77.4126 },
  { code: "RPR", name: "Raipur", state: "Chhattisgarh", stateCode: "CG", type: "warehouse", zone: "Central", lat: 21.2514, lng: 81.6296 },
  { code: "BHI", name: "Bhilai", state: "Chhattisgarh", stateCode: "CG", type: "plant", zone: "Central", lat: 21.1938, lng: 81.3509 },

  // ----------------------------------------------------------------- South
  { code: "BLR", name: "Bengaluru", state: "Karnataka", stateCode: "KA", type: "warehouse", zone: "South", lat: 12.9716, lng: 77.5946 },
  { code: "NLM", name: "Nelamangala", state: "Karnataka", stateCode: "KA", type: "depot", zone: "South", lat: 13.0996, lng: 77.3936 },
  { code: "BLG", name: "Belagavi", state: "Karnataka", stateCode: "KA", type: "depot", zone: "South", lat: 15.8497, lng: 74.4977 },
  { code: "HBL", name: "Hubballi", state: "Karnataka", stateCode: "KA", type: "depot", zone: "South", lat: 15.3647, lng: 75.1240 },
  { code: "MNG", name: "Mangaluru", state: "Karnataka", stateCode: "KA", type: "port", zone: "South", lat: 12.9141, lng: 74.8560 },

  { code: "HSR", name: "Hosur", state: "Tamil Nadu", stateCode: "TN", type: "plant", zone: "South", lat: 12.7409, lng: 77.8253 },
  { code: "MAA", name: "Chennai", state: "Tamil Nadu", stateCode: "TN", type: "warehouse", zone: "South", lat: 13.0827, lng: 80.2707 },
  { code: "SPD", name: "Sriperumbudur", state: "Tamil Nadu", stateCode: "TN", type: "plant", zone: "South", lat: 12.9675, lng: 79.9430 },
  { code: "ENR", name: "Ennore", state: "Tamil Nadu", stateCode: "TN", type: "port", zone: "South", lat: 13.2333, lng: 80.3167 },
  { code: "CBE", name: "Coimbatore", state: "Tamil Nadu", stateCode: "TN", type: "plant", zone: "South", lat: 11.0168, lng: 76.9558 },
  { code: "MDU", name: "Madurai", state: "Tamil Nadu", stateCode: "TN", type: "depot", zone: "South", lat: 9.9252, lng: 78.1198 },

  { code: "HYD", name: "Hyderabad", state: "Telangana", stateCode: "TG", type: "warehouse", zone: "South", lat: 17.3850, lng: 78.4867 },
  { code: "VTZ", name: "Visakhapatnam", state: "Andhra Pradesh", stateCode: "AP", type: "port", zone: "South", lat: 17.6868, lng: 83.2185 },
  { code: "VJA", name: "Vijayawada", state: "Andhra Pradesh", stateCode: "AP", type: "depot", zone: "South", lat: 16.5062, lng: 80.6480 },
  { code: "SRC", name: "Sri City", state: "Andhra Pradesh", stateCode: "AP", type: "plant", zone: "South", lat: 13.5500, lng: 80.0200 },
  { code: "COK", name: "Kochi", state: "Kerala", stateCode: "KL", type: "port", zone: "South", lat: 9.9312, lng: 76.2673 },

  // ------------------------------------------------------------------ East
  { code: "CCU", name: "Kolkata", state: "West Bengal", stateCode: "WB", type: "warehouse", zone: "East", lat: 22.5726, lng: 88.3639 },
  { code: "HLD", name: "Haldia", state: "West Bengal", stateCode: "WB", type: "port", zone: "East", lat: 22.0667, lng: 88.0698 },
  { code: "SLG", name: "Siliguri", state: "West Bengal", stateCode: "WB", type: "depot", zone: "East", lat: 26.7271, lng: 88.3953 },
  { code: "JSR", name: "Jamshedpur", state: "Jharkhand", stateCode: "JH", type: "plant", zone: "East", lat: 22.8046, lng: 86.2029 },
  { code: "RNC", name: "Ranchi", state: "Jharkhand", stateCode: "JH", type: "depot", zone: "East", lat: 23.3441, lng: 85.3096 },
  { code: "RKL", name: "Rourkela", state: "Odisha", stateCode: "OD", type: "plant", zone: "East", lat: 22.2604, lng: 84.8536 },
  { code: "BBI", name: "Bhubaneswar", state: "Odisha", stateCode: "OD", type: "warehouse", zone: "East", lat: 20.2961, lng: 85.8245 },
  { code: "PRD", name: "Paradip", state: "Odisha", stateCode: "OD", type: "port", zone: "East", lat: 20.3167, lng: 86.6167 },
  { code: "PAT", name: "Patna", state: "Bihar", stateCode: "BR", type: "depot", zone: "East", lat: 25.5941, lng: 85.1376 },

  // ------------------------------------------------------------ North-East
  { code: "GAU", name: "Guwahati", state: "Assam", stateCode: "AS", type: "warehouse", zone: "North-East", lat: 26.1445, lng: 91.7362 },
];

export const NODE_BY_CODE: ReadonlyMap<string, FreightNode> = new Map(
  NODES.map((n) => [n.code, n]),
);

export function nodeName(code: string): string {
  return NODE_BY_CODE.get(code)?.name ?? code;
}
