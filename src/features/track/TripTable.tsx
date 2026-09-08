import { vehicleLabel } from "../../domain/fleet";
import { age, duration, istDateTime } from "../../domain/format";
import { delayHours, worstOpen } from "../../domain/kpis";
import { LANE_BY_ID, laneLabel } from "../../domain/lanes";
import { transporterName } from "../../domain/transporters";
import type { Trip } from "../../domain/types";
import { Chip, StatusPill, Table, TableWrap, TBody, TD, TH, THead, TR } from "../../ui";
import { STATUS_LABEL, STATUS_TONE } from "./present";

/* A plain table over the generated fleet. Phase 4 replaces the body with a
   virtualised one and adds sorting, filtering, column config and saved views;
   the columns and the data behind them are already final. */

export function TripTable({
  trips,
  now,
  limit = 150,
}: {
  trips: readonly Trip[];
  now: number;
  limit?: number;
}) {
  const rows = trips.slice(0, limit);

  return (
    <TableWrap className="h-full">
      <Table label="Trips">
        <THead>
          <TH width={124}>LR no.</TH>
          <TH>Lane</TH>
          <TH width={150}>Transporter</TH>
          <TH width={132}>Vehicle</TH>
          <TH width={104}>Type</TH>
          <TH width={116}>Status</TH>
          <TH width={104}>Exception</TH>
          <TH width={116}>ETA</TH>
          <TH width={82} align="right">Delay</TH>
          <TH width={82} align="right">Last ping</TH>
        </THead>
        <TBody>
          {rows.map((t) => {
            const lane = LANE_BY_ID.get(t.laneId)!;
            const worst = worstOpen(t);
            const delay = delayHours(t);
            const openCount = t.exceptions.filter((e) => e.resolvedAt === null).length;

            return (
              <TR key={t.id}>
                <TD mono>{t.docs.lrNo}</TD>
                <TD>{laneLabel(lane)}</TD>
                <TD>{transporterName(t.transporterCode)}</TD>
                <TD mono>{t.vehicle.regNo}</TD>
                <TD muted>{vehicleLabel(t.vehicle.typeCode)}</TD>
                <TD>
                  <StatusPill tone={STATUS_TONE[t.status]}>
                    {STATUS_LABEL[t.status]}
                  </StatusPill>
                </TD>
                <TD>
                  {worst ? (
                    <span className="inline-flex items-center gap-1">
                      <Chip
                        tone={
                          worst.severity === "critical"
                            ? "crit"
                            : worst.severity === "high"
                              ? "warn"
                              : worst.severity === "medium"
                                ? "info"
                                : "neutral"
                        }
                        mono
                      >
                        {worst.code}
                      </Chip>
                      {openCount > 1 && (
                        <span className="text-[11px] text-ink-faint tabular-nums">
                          +{openCount - 1}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </TD>
                <TD mono muted={t.status === "planned"}>
                  {istDateTime(t.etaAt)}
                </TD>
                <TD align="right" mono>
                  {delay > 0 ? (
                    // Colour goes on the value, not the cell: two colour
                    // utilities on one element resolve by stylesheet order,
                    // not by the order they are written in.
                    <span className="text-warn">{duration(delay)}</span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD align="right" mono muted>
                  {t.status === "delivered" ? "—" : age(t.lastPingAt, now)}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableWrap>
  );
}
