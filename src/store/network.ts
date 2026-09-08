import { generateNetwork, DEFAULT_NOW, DEFAULT_SEED, DEFAULT_TRIP_COUNT } from "../sim/generate";
import type { Network } from "../domain/types";

/* The generated fleet, built once per page load and shared by every view.

   Phase 2 replaces this module with a live store driven by the tick engine.
   Keeping the read side behind one accessor now means the swap does not
   ripple through the feature code. */

let cached: Network | null = null;

export function getNetwork(): Network {
  if (!cached) {
    cached = generateNetwork({
      seed: DEFAULT_SEED,
      count: DEFAULT_TRIP_COUNT,
      now: DEFAULT_NOW,
    });
  }
  return cached;
}

export { DEFAULT_NOW, DEFAULT_SEED, DEFAULT_TRIP_COUNT };
