import { IST_OFFSET_MS } from "./documents";

/* Display helpers. Rupees group the Indian way — 12,45,600, not 1,245,600 —
   and everything a controller reads back over a phone line is tabular. */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const NUM_IN = new Intl.NumberFormat("en-IN");

export function inr(value: number): string {
  return INR.format(Math.round(value));
}

/** "₹1.25 L" / "₹4.8 Cr" — how freight spend is actually quoted here. */
export function inrCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1)}k`;
  return `₹${Math.round(value)}`;
}

export function num(value: number): string {
  return NUM_IN.format(value);
}

export function km(value: number): string {
  return `${NUM_IN.format(Math.round(value))} km`;
}

export function mt(value: number): string {
  return `${value.toFixed(1)} MT`;
}

export function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** "4h 20m", "18m", "2d 6h" — never a bare decimal number of hours. */
export function duration(hours: number): string {
  const sign = hours < 0 ? "-" : "";
  const total = Math.abs(Math.round(hours * 60));
  if (total < 60) return `${sign}${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h < 24) return m ? `${sign}${h}h ${String(m).padStart(2, "0")}m` : `${sign}${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${sign}${d}d ${rh}h` : `${sign}${d}d`;
}

/** Age of a timestamp against a given now, as "18m" / "3h 10m" / "2d 6h". */
export function age(fromMs: number, nowMs: number): string {
  return duration(Math.max(0, nowMs - fromMs) / 3_600_000);
}

const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const IST_DATETIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const IST_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function istTime(ms: number): string {
  return IST_TIME.format(new Date(ms));
}

export function istDateTime(ms: number): string {
  return IST_DATETIME.format(new Date(ms)).replace(",", "");
}

export function istDate(ms: number): string {
  return IST_DATE.format(new Date(ms));
}

/** Hour of day in IST, 0–23. Night-halt logic reads this. */
export function istHour(ms: number): number {
  return Math.floor(((ms + IST_OFFSET_MS) % 86_400_000) / 3_600_000);
}
