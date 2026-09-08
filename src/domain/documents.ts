/* Statutory and commercial paperwork that rides with an Indian FTL trip.

   The e-way bill is the one that bites operationally: it expires on a clock
   the controller does not own, and a truck caught with an expired bill is
   detained and penalised. That is why EX-07 is critical rather than a warning. */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Next IST midnight strictly after `ms`. */
export function istMidnightAfter(ms: number): number {
  const local = ms + IST_OFFSET_MS;
  const dayStart = Math.floor(local / 86_400_000) * 86_400_000;
  return dayStart + 86_400_000 - IST_OFFSET_MS;
}

/**
 * Validity in days under Rule 138 of the CGST Rules: one day for the first
 * 200 km and one further day for every additional 200 km or part thereof.
 * Over-dimensional cargo runs on a 20 km step instead.
 */
export function ewayValidityDays(distanceKm: number, overDimensional = false): number {
  const step = overDimensional ? 20 : 200;
  return Math.max(1, Math.ceil(distanceKm / step));
}

/**
 * Expiry moment for an e-way bill.
 *
 * The rule counts a "day" as expiring at midnight of the day immediately
 * following generation — so a bill raised at 23:40 gets barely twenty minutes
 * out of its first day. Modelling that honestly is what makes the expiry
 * countdown in the trip drawer behave the way a compliance team expects.
 */
export function ewayValidUntil(
  generatedAt: number,
  distanceKm: number,
  overDimensional = false,
): number {
  const days = ewayValidityDays(distanceKm, overDimensional);
  return istMidnightAfter(generatedAt) + (days - 1) * 86_400_000;
}

/* --------------------------------------------------------- number shapes --- */

/** "LR/26/0088214" — consignor series, financial year, running number. */
export function formatLrNo(serial: number): string {
  return `LR/26/${String(serial).padStart(7, "0")}`;
}

/** Twelve digits, grouped the way the GST portal prints them. */
export function formatEwayBillNo(digits: number): string {
  const s = String(digits).padStart(12, "0");
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)}`;
}

/** "SI/2627/04821" — consignor initials, financial year, running number. */
export function formatInvoiceNo(serial: number): string {
  return `SI/2627/${String(serial).padStart(5, "0")}`;
}

/** "WB/BHW/09/44821" — weighbridge, origin node, month, slip number. */
export function formatWeighbridgeSlipNo(originCode: string, serial: number): string {
  return `WB/${originCode}/09/${String(serial).padStart(5, "0")}`;
}

/** Consignor GSTIN. State code, PAN, entity number, Z, check character. */
export function formatGstin(stateCode2: string, pan: string, entity: number, check: string): string {
  return `${stateCode2}${pan}${entity}Z${check}`;
}

/** The consignor this console belongs to. Fictional. */
export const CONSIGNOR = {
  name: "Suryan Industries Ltd",
  short: "Suryan Industries",
  initials: "SI",
  gstin: formatGstin("27", "AABCS1429B", 1, "K"),
} as const;
