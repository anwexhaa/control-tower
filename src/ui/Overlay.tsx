import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { IconButton } from "./Button";
import { IconClose } from "./icons";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Escape to close, Tab cycles inside, focus restores to whatever opened it.
 * Every overlay in the app goes through this so the behaviour cannot drift.
 */
function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;

    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !node) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, onClose, ref]);
}

function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 bg-[var(--overlay)]"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  side = "right",
  width = 480,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  side?: "right" | "left";
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <Scrim onClose={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        style={{ width }}
        className={cx(
          "absolute top-0 bottom-0 flex max-w-[92vw] flex-col border-line bg-panel shadow-lg",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-semibold text-ink">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-[12px] text-ink-mute">{subtitle}</p>
            )}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <IconClose size={15} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft bg-sunken px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Scrim onClose={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        style={{ width }}
        className="relative flex max-h-[86vh] w-full flex-col rounded-md border border-line bg-panel shadow-lg"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-line-soft px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {title}
          </h2>
          <IconButton label="Close" size="sm" onClick={onClose}>
            <IconClose size={15} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line-soft bg-sunken px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
