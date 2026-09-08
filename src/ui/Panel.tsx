import type { ReactNode } from "react";
import { cx } from "../lib/cx";

/* Border, fill and shadow are spent by role rather than stamped on everything:
   a Panel is a region of the console, a Card is a discrete object inside one. */

export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag
      className={cx(
        "flex min-h-0 flex-col overflow-hidden border border-line bg-panel",
        "rounded-md",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        "flex shrink-0 items-center gap-3 border-b border-line-soft bg-sunken",
        "px-3 py-2",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[11px] font-medium tracking-[0.1em] text-ink-mute uppercase">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-[12px] text-ink-faint">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

export function PanelBody({
  children,
  className,
  scroll = true,
  /** Off for content that manages its own edges — a table, a map, a list. */
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={cx("min-h-0 flex-1", scroll && "overflow-auto", className)}
      style={padded ? { padding: "var(--panel-pad)" } : undefined}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-sm border border-line-soft bg-raised p-3",
        interactive && "cursor-pointer transition-colors hover:border-line-strong hover:bg-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Label above a figure — the pairing used across the KPI strip and detail views. */
export function Metric({
  label,
  value,
  unit,
  delta,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="truncate text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[22px] leading-none font-semibold tabular-nums text-ink">
          {value}
        </span>
        {unit && <span className="text-[12px] text-ink-mute">{unit}</span>}
        {delta}
      </div>
    </div>
  );
}
