/* Seeded pseudo-randomness.

   Every number in the dataset comes from here, so the same seed always
   produces the same fleet. A demo that reshuffles on refresh cannot be talked
   through in an interview — "look at LR/26/0088214" has to mean something
   five minutes later. */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  bool(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Pick by relative weight: [["a", 3], ["b", 1]] picks "a" three times as often. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T;
  /** Normal deviate, clamped to ±3 standard deviations. */
  gauss(mean: number, sd: number): number;
  /** Random digit string of the given length. */
  digits(length: number): string;
}

/** Mulberry32 — small, fast, and good enough for generating a fleet. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    bool: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (entries) => {
      let total = 0;
      for (const [, w] of entries) total += w;
      let roll = next() * total;
      for (const [value, w] of entries) {
        roll -= w;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    gauss: (mean, sd) => {
      // Box–Muller. u must be non-zero for the log.
      const u = 1 - next();
      const v = next();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + sd * Math.max(-3, Math.min(3, z));
    },
    digits: (length) => {
      let out = "";
      for (let i = 0; i < length; i++) out += Math.floor(next() * 10);
      return out;
    },
  };

  return rng;
}
