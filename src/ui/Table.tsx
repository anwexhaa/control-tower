import type { ReactNode, ThHTMLAttributes } from "react";
import { cx } from "../lib/cx";

/* Density-aware table shell. Row height, cell padding and data type size all
   come from --row-h / --row-px / --data-size, so the compact toggle moves the
   whole console at once instead of one component at a time.

   Phase 4 swaps <TBody> for a virtualised body; these primitives stay. */

export type SortDirection = "asc" | "desc" | null;

export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-h-0 w-full overflow-auto", className)}>{children}</div>
  );
}

export function Table({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <table
      aria-label={label}
      className={cx("w-full border-collapse text-left", className)}
      style={{ fontSize: "var(--data-size)", lineHeight: "var(--data-lh)" }}
    >
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-sunken">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  sortable = false,
  sorted = null,
  onSort,
  align = "left",
  width,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & {
  children: ReactNode;
  sortable?: boolean;
  sorted?: SortDirection;
  onSort?: () => void;
  align?: "left" | "right";
  width?: number | string;
}) {
  return (
    <th
      scope="col"
      style={{ width, paddingInline: "var(--row-px)" }}
      aria-sort={
        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
      }
      className={cx(
        "h-8 border-b border-line font-medium whitespace-nowrap text-ink-mute",
        "text-[10.5px] tracking-[0.09em] uppercase",
        align === "right" && "text-right",
        className,
      )}
      {...rest}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cx(
            "inline-flex items-center gap-1 uppercase transition-colors hover:text-ink",
            sorted && "text-accent",
          )}
        >
          {children}
          <span aria-hidden="true" className="text-[9px] leading-none">
            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "△"}
          </span>
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  selected = false,
  onClick,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      aria-selected={onClick ? selected : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{ height: "var(--row-h)" }}
      className={cx(
        "border-b border-line-soft transition-colors",
        onClick && "cursor-pointer",
        selected ? "bg-accent-soft" : onClick && "hover:bg-hover",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = "left",
  mono = false,
  muted = false,
  className,
  colSpan,
}: {
  children: ReactNode;
  align?: "left" | "right";
  mono?: boolean;
  muted?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{ paddingInline: "var(--row-px)" }}
      className={cx(
        "truncate",
        align === "right" && "text-right",
        mono && "font-mono text-[0.92em] tabular-nums",
        muted ? "text-ink-mute" : "text-ink-soft",
        className,
      )}
    >
      {children}
    </td>
  );
}
