import { age, duration, istDateTime } from "../../domain/format";
import { openCount, worstOpen } from "../../domain/kpis";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { transporterName } from "../../domain/transporters";
import type { Trip, TripState } from "../../domain/types";
import { Chip, StatusPill, Table, TableWrap, TBody, TD, TH, THead, TR } from "../../ui";
import { STATUS_LABEL, STATUS_TONE } from "./present";

/* A plain table over the live fleet. Phase 4 replaces the body with a
   virtualised one and adds sorting, filtering, column config and saved views;
   the columns and the data behind them are already final. */

const SEVERITY_TONE = {
  critical: "crit",
  high: "warn",
  medium: "info",
  low: "neutral",
} as const;

export function TripTable({
  trips,
  states,
  now,
  limit = 150,
}: {
  trips: readonly Trip[];
  states: ReadonlyMap<string, TripState>;
  now: number;
  limit?: number;
}) {
  return (
    <TableWrap className="h-full">
      <Table label="Trips">
        <THead>
          <TH width={124}>LR no.</TH>
          <TH>Lane</TH>
          <TH width={150}>Transporter</TH>
          <TH width={132}>Vehicle</TH>
          <TH width={70} align="right">Done</TH>
          <TH width={78} align="right">Speed</TH>
          <TH width={116}>Status</TH>
          <TH width={104}>Exception</TH>
          <TH width={116}>ETA</TH>
          <TH width={82} align="right">Delay</TH>
          <TH width={82} align="right">Last ping</TH>
        </THead>
        <TBody>
          {trips.slice(0, limit).map((t) => {
            const s = states.get(t.id);
            if (!s) return null;
            const lane = LANE_BY_ID.get(t.laneId)!;
            const worst = worstOpen(s.exceptions);
            const open = openCount(s.exceptions);

            return (
              <TR key={t.id}>
                <TD mono>{t.docs.lrNo}</TD>
                <TD>{laneLabel(lane)}</TD>
                <TD>{transporterName(t.transporterCode)}</TD>
                <TD mono>{t.vehicle.regNo}</TD>
                <TD align="right" mono muted>
                  {s.status === "planned" ? "—" : `${Math.round(s.progress * 100)}%`}
                </TD>
                <TD align="right" mono muted>
                  {s.speedKmph > 0.5 ? Math.round(s.speedKmph) : "—"}
                </TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[s.status]}>
                    {STATUS_LABEL[s.status]}
                  </StatusPill>
                </TD>
                <TD>
                  {worst ? (
                    <span className="inline-flex items-center gap-1">
                      <Chip tone={SEVERITY_TONE[worst.severity]} mono>
                        {worst.code}
                      </Chip>
                      {open > 1 && (
                        <span className="text-[11px] text-ink-faint tabular-nums">
                          +{open - 1}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </TD>
                <TD mono muted={s.status === "planned"}>
                  {istDateTime(s.etaAt)}
                </TD>
                <TD align="right" mono>
                  {s.delayHours > 0 ? (
                    // Colour goes on the value, not the cell: two colour
                    // utilities on one element resolve by stylesheet order,
                    // not the order they are written in.
                    <span className="text-warn">{duration(s.delayHours)}</span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD align="right" mono muted>
                  {s.status === "delivered" || s.status === "planned"
                    ? "—"
                    : age(s.lastPingAt, now)}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
