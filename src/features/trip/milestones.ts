import { MILESTONE_LABEL, MILESTONE_SEQUENCE } from "../../domain/types";
import type { MilestoneKey, Trip, TripState } from "../../domain/types";

/* Planned against actual, for the eleven-step chain.

   The plan is fixed at generation; the actual chain is anchored on when the
   truck really arrived, which the movement model decides. Everything after
   arrival therefore shifts with it — a truck that lands six hours late does
   not magically invoice on time, and showing that is the point of the view. */

const H = 3_600_000;

/** Steps that happen before the wheels turn: fixed facts on the plan. */
const PRE_DISPATCH: MilestoneKey[] = [
  "indent_raised",
  "transporter_accepted",
  "vehicle_placed",
  "gate_in",
  "loading_complete",
  "gate_out",
];

export interface DerivedMilestone {
  key: MilestoneKey;
  label: string;
  plannedAt: number;
  /** Set once the step has actually happened. */
  actualAt: number | null;
  /** Where we expect it to land, for steps still ahead. */
  projectedAt: number;
  /** Hours late (positive) or early (negative) against plan. */
  varianceH: number;
  /** Time held at a gate, called out on the steps where it accrues. */
  dwellH: number | null;
}

export function deriveMilestones(
  trip: Trip,
  state: TripState,
  now: number,
): DerivedMilestone[] {
  const planned = new Map<MilestoneKey, number>();
  for (const m of trip.milestones) planned.set(m.key, m.plannedAt);

  const plannedArrival = planned.get("arrived_destination")!;
  const unloadOffset = planned.get("unloading_complete")! - plannedArrival;
  const podOffset = planned.get("pod_uploaded")! - planned.get("unloading_complete")!;
  const invoiceOffset = planned.get("invoiced")! - planned.get("pod_uploaded")!;

  // Everything downstream of arrival hangs off when the truck actually landed;
  // until then it hangs off the current projection.
  const arrivalAnchor = state.arrivedAt ?? state.etaAt;
  const projected = new Map<MilestoneKey, number>(planned);
  projected.set("arrived_destination", arrivalAnchor);
  projected.set("unloading_complete", arrivalAnchor + unloadOffset);
  projected.set("pod_uploaded", arrivalAnchor + unloadOffset + podOffset);
  projected.set("invoiced", arrivalAnchor + unloadOffset + podOffset + invoiceOffset);

  return MILESTONE_SEQUENCE.map((key) => {
    const plannedAt = planned.get(key)!;
    const projectedAt = projected.get(key)!;

    let actualAt: number | null = null;
    if (PRE_DISPATCH.includes(key)) {
      actualAt = plannedAt <= now ? plannedAt : null;
    } else if (key === "in_transit") {
      actualAt = trip.dispatchedAt <= now ? trip.dispatchedAt : null;
    } else {
      actualAt = projectedAt <= now ? projectedAt : null;
    }

    let dwellH: number | null = null;
    if (key === "gate_out") dwellH = trip.detentionOriginH;
    if (key === "unloading_complete") dwellH = trip.detentionDestH;

    return {
      key,
      label: MILESTONE_LABEL[key],
      plannedAt,
      actualAt,
      projectedAt,
      varianceH: (projectedAt - plannedAt) / H,
      dwellH,
    };
  });
}

/** Index of the step the trip is currently working on. */
export function currentStep(milestones: DerivedMilestone[]): number {
  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i].actualAt === null) return i;
  }
  return milestones.length - 1;
}
