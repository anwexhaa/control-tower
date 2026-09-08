import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../lib/cx";
import { IconButton } from "./Button";
import { IconAlert, IconCheck, IconClose, IconInfo } from "./icons";
import type { Tone } from "./Chip";

/* -------------------------------------------------------------- tooltip --- */

export function Tooltip({
  label,
  children,
  side = "bottom",
  className,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={cx("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cx(
          "pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap",
          "rounded-xs border border-line bg-raised px-1.5 py-0.5 text-[11.5px] text-ink-soft",
          "opacity-0 shadow-md transition-opacity duration-100",
          "group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "bottom" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------- skeleton --- */

export function Skeleton({
  className,
  rounded = "sm",
}: {
  className?: string;
  rounded?: "xs" | "sm" | "full";
}) {
  return (
    <div
      className={cx(
        "animate-pulse bg-line-soft",
        rounded === "full" ? "rounded-full" : rounded === "sm" ? "rounded-sm" : "rounded-xs",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[var(--row-h)] w-full" />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- empty state --- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <div className="mb-1 text-ink-faint">{icon}</div>}
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-ink-mute">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- toast --- */

export type Toast = {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
};

type ToastApi = { push: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const toastIcon: Record<Tone, ReactNode> = {
  neutral: <IconInfo size={15} />,
  info: <IconInfo size={15} />,
  ok: <IconCheck size={15} />,
  warn: <IconAlert size={15} />,
  crit: <IconAlert size={15} />,
};

const toastAccent: Record<Tone, string> = {
  neutral: "text-ink-mute",
  info: "text-info",
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      5000,
    );
  }, []);

  const dismiss = useCallback(
    (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)),
    [],
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[320px] flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2.5 rounded-md border border-line bg-raised p-3 shadow-lg"
          >
            <span className={cx("mt-px shrink-0", toastAccent[t.tone])}>
              {toastIcon[t.tone]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{t.title}</p>
              {t.detail && (
                <p className="mt-0.5 text-[12px] leading-snug text-ink-mute">
                  {t.detail}
                </p>
              )}
            </div>
            <IconButton label="Dismiss" size="sm" onClick={() => dismiss(t.id)}>
              <IconClose size={13} />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
