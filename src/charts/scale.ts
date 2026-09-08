/* One scale module, shared by every chart in Pulse.

   Ticks are chosen from the data rather than from round numbers alone, so every
   label names a value the chart actually reaches — an axis that tops out at 50
   on a series whose maximum is 43 is telling the reader something untrue about
   the shape. */

export interface Scale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;

  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale;
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/** A rounded step at or above the raw interval, in the 1/2/5 family. */
function niceStep(raw: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalised = raw / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Tick values across a domain, always including the top of the range so the
 * axis names the largest value present.
 */
export function ticks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min || 0];

  const step = niceStep((max - min) / Math.max(1, count));
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) {
    out.push(Number(v.toFixed(6)));
  }
  if (out.length === 0) out.push(min, max);
  return out;
}

/** Domain padded to a nice top, never below zero for a count-like measure. */
export function niceDomain(values: readonly number[], fromZero = true): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (fromZero) min = Math.min(0, min);
  if (max === min) max = min + 1;
  return [min, max];
}
