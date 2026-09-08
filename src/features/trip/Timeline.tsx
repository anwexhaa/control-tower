import { duration, istDateTime } from "../../domain/format";
import { cx } from "../../lib/cx";
import { currentStep, type DerivedMilestone } from "./milestones";

/* The eleven steps, with what was promised beside what happened.

   Steps still ahead are shown as projections rather than hidden, because the
   question a controller is answering — "when does this actually land" — is
   about the steps that have not happened yet. */

export function Timeline({
  milestones,
  now,
}: {
  milestones: DerivedMilestone[];
  now: number;
}) {
  const active = currentStep(milestones);

  return (
    <ol className="flex flex-col">
      {milestones.map((m, i) => {
        const done = m.actualAt !== null;
        const isCurrent = i === active;
        const late = m.varianceH > 0.25;
        const early = m.varianceH < -0.25;

        return (
          <li key={m.key} className="relative flex gap-3 pb-3 last:pb-0">
            {/* spine */}
            {i < milestones.length - 1 && (
              <span
                aria-hidden="true"
                className={cx(
                  "absolute top-4 bottom-0 left-[5px] w-px",
                  done ? "bg-ok" : "bg-line",
                )}
              />
            )}

            <span
              aria-hidden="true"
              className={cx(
                "relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2",
                done
                  ? "border-ok bg-ok"
                  : isCurrent
                    ? "border-accent bg-panel"
                    : "border-line-strong bg-panel",
              )}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span
                  className={cx(
                    "text-[12.5px]",
                    done ? "font-medium text-ink" : isCurrent ? "text-accent" : "text-ink-mute",
                  )}
                >
                  {m.label}
                </span>

                <span
                  className={cx(
                    "ml-auto shrink-0 font-mono text-[11px] tabular-nums",
                    done ? "text-ink-soft" : "text-ink-faint",
                  )}
                >
                  {istDateTime(done ? m.actualAt! : m.projectedAt)}
                  {!done && <span className="ml-1 text-ink-faint">est</span>}
                </span>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                {(late || early) && (
                  <span className={late ? "text-warn" : "text-ok"}>
                    {late ? "+" : "−"}
                    {duration(Math.abs(m.varianceH))} against plan
                  </span>
                )}
                {m.dwellH !== null && m.dwellH > 0.1 && (
                  <span className="text-ink-mute">
                    {duration(m.dwellH)} at the gate
                  </span>
                )}
                {isCurrent && !done && (
                  <span className="text-ink-faint">
                    in {duration((m.projectedAt - now) / 3_600_000)}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
