import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";
import { IconSpinner } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium " +
  "whitespace-nowrap select-none transition-colors duration-100 " +
  "disabled:opacity-45 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent-solid text-on-accent hover:bg-accent-hover active:bg-accent-press " +
    "shadow-sm",
  secondary:
    "bg-panel text-ink border border-line hover:bg-hover hover:border-line-strong " +
    "active:bg-active",
  ghost:
    "text-ink-soft hover:bg-hover hover:text-ink active:bg-active bg-transparent",
  danger:
    "bg-crit-soft text-crit border border-crit-line hover:bg-crit hover:text-panel " +
    "active:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px]",
  md: "h-8.5 px-3.5 text-[13.5px]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  leading,
  trailing,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <IconSpinner size={14} /> : leading}
      {children}
      {trailing}
    </button>
  );
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required — an icon-only control must still announce itself. */
  label: string;
  variant?: Variant;
  size?: Size;
  active?: boolean;
};

export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  active = false,
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cx(
        base,
        variants[variant],
        size === "sm" ? "h-7 w-7" : "h-8.5 w-8.5",
        active && "bg-active text-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
