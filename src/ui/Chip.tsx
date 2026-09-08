import type { ReactNode } from "react";
import { cx } from "../lib/cx";

/* Tones map to the semantic token layer only. Interaction blue is never a tone,
   so a coloured thing on this screen always means a freight condition. */

export type Tone = "neutral" | "ok" | "info" | "warn" | "crit";
export type Severity = "low" | "medium" | "high" | "critical";

export const severityTone: Record<Severity, Tone> = {
  low: "neutral",
  medium: "info",
  high: "warn",
  critical: "crit",
};

const toneChip: Record<Tone, string> = {
  neutral: "bg-idle-soft text-ink-mute border-idle-line",
  ok: "bg-ok-soft text-ok border-ok-line",
  info: "bg-info-soft text-info border-info-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  crit: "bg-crit-soft text-crit border-crit-line",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-idle",
  ok: "bg-ok",
  info: "bg-info",
  warn: "bg-warn",
  crit: "bg-crit",
};

export function Chip({
  tone = "neutral",
  children,
  className,
  mono = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-xs border px-1.5 py-px",
        "text-[10.5px] leading-[16px] font-medium tracking-[0.04em] uppercase",
        mono && "font-mono tracking-[0.02em]",
        toneChip[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A count or short value that sits against a label. */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-w-[18px] items-center justify-center rounded-full border",
        "px-1.5 h-[18px] text-[11px] font-semibold tabular-nums",
        toneChip[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Severity is encoded twice — colour and shape — so it survives both a
 * colour-blind reader and a monochrome screenshot.
 */
export function SeverityDot({
  severity,
  pulse = false,
  className,
}: {
  severity: Severity;
  pulse?: boolean;
  className?: string;
}) {
  const tone = severityTone[severity];
  const shape =
    severity === "critical"
      ? "rounded-[1px] rotate-45"
      : severity === "high"
        ? "rounded-[1px]"
        : "rounded-full";
  return (
    <span
      className={cx("relative inline-flex h-2 w-2 shrink-0", className)}
      role="img"
      aria-label={`${severity} severity`}
    >
      {pulse && (
        <span
          className={cx(
            "absolute inset-0 animate-ping opacity-60",
            shape,
            toneDot[tone],
          )}
        />
      )}
      <span className={cx("relative inline-block h-2 w-2", shape, toneDot[tone])} />
    </span>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-soft",
        className,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDot[tone])} />
      {children}
    </span>
  );
}
