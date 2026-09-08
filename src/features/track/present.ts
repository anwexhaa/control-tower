import type { Tone } from "../../ui";
import type { TripStatus } from "../../domain/types";

/* How freight state is spoken and coloured on screen. Kept in one place so a
   status never reads "In transit" here and "Running" three panels over. */

export const STATUS_LABEL: Record<TripStatus, string> = {
  planned: "Not started",
  in_transit: "In transit",
  at_risk: "At risk",
  delivered: "Delivered",
};

export const STATUS_TONE: Record<TripStatus, Tone> = {
  planned: "neutral",
  in_transit: "info",
  at_risk: "warn",
  delivered: "ok",
};
