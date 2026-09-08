import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
} from "react";
import { cx } from "../lib/cx";
import { IconChevronDown, IconSearch } from "./icons";

const control =
  "h-8.5 w-full rounded-sm border border-line bg-panel px-2.5 text-[13px] " +
  "text-ink placeholder:text-ink-faint transition-colors " +
  "hover:border-line-strong focus:border-accent " +
  "disabled:opacity-45 disabled:pointer-events-none";

export function SearchInput({
  className,
  hint,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  hint?: ReactNode;
  /** React 19 passes ref through as an ordinary prop. */
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <div className={cx("relative", className)}>
      <IconSearch
        size={15}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        className={cx(control, "pl-8", hint ? "pr-16" : null)}
        {...rest}
      />
      {hint && (
        <div className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
          {hint}
        </div>
      )}
    </div>
  );
}

export function Select({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId();
  return (
    <div className={cx("relative", className)}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select id={id} className={cx(control, "appearance-none pr-7")} {...rest}>
          {children}
        </select>
        <IconChevronDown
          size={14}
          className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ink-mute"
        />
      </div>
    </div>
  );
}

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
  title?: string;
};

/** Used for sim speed, density and any other small exclusive choice. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = "md",
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        "inline-flex items-center gap-0.5 rounded-sm border border-line bg-sunken p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-xs font-medium transition-colors duration-100",
              size === "sm" ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-[12.5px]",
              selected
                ? "bg-panel text-ink shadow-sm"
                : "text-ink-mute hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-4.5 w-8 shrink-0 rounded-full border transition-colors duration-150",
        checked ? "border-accent-solid bg-accent-solid" : "border-line-strong bg-sunken",
        className,
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-3 w-3 rounded-full transition-all duration-150",
          checked ? "left-4 bg-on-accent" : "left-0.5 bg-ink-faint",
        )}
      />
    </button>
  );
}
