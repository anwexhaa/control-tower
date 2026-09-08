import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { Badge, IconButton, KeyHint, SearchInput, SegmentedControl, Tooltip } from "../ui";
import { IconBell, IconChevronDown } from "../ui/icons";

/* Sim speed multipliers. Phase 2 replaces this local clock with the real
   engine; the control surface is built here so the shell is complete. */

const SPEEDS = [
  { value: "0", label: "❙❙", title: "Paused" },
  { value: "1", label: "1×", title: "Real time" },
  { value: "60", label: "60×", title: "One minute per second" },
  { value: "600", label: "600×", title: "Ten minutes per second" },
] as const;

type Speed = (typeof SPEEDS)[number]["value"];

/** Fixed start so every demo opens on the same shift: 08 Sep 2026, 06:40 IST. */
const SIM_EPOCH = Date.UTC(2026, 8, 8, 1, 10, 0);

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function useSimClock(speed: Speed) {
  const [ms, setMs] = useState(SIM_EPOCH);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    const mult = Number(speed);
    if (mult === 0) return;

    last.current = performance.now();
    const step = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setMs((v) => v + dt * mult);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [speed]);

  return ms;
}

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [speed, setSpeed] = useState<Speed>("60");
  const simMs = useSimClock(speed);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const parts = IST.formatToParts(new Date(simMs));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const stamp = `${get("weekday")} ${get("day")} ${get("month")}`;
  const time = `${get("hour")}:${get("minute")}`;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      {/* org context */}
      <button
        type="button"
        className="flex h-8 items-center gap-2 rounded-sm border border-transparent px-2 text-left transition-colors hover:border-line hover:bg-hover"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-xs bg-accent-solid text-[11px] font-semibold text-on-accent">
          SI
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-[12.5px] leading-tight font-medium text-ink">
            Suryan Industries
          </span>
          <span className="block truncate text-[10.5px] leading-tight text-ink-faint">
            All zones · FTL
          </span>
        </span>
        <IconChevronDown size={13} className="shrink-0 text-ink-faint" />
      </button>

      <div className="h-5 w-px bg-line" />

      {/* page identity */}
      <div className="min-w-0">
        <h1 className="truncate text-[13.5px] leading-tight font-semibold text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-[11px] leading-tight text-ink-mute">{subtitle}</p>
        )}
      </div>

      <div className="flex-1" />

      <SearchInput
        ref={searchRef}
        placeholder="Search LR, vehicle, transporter…"
        aria-label="Search"
        className="hidden w-[280px] lg:block"
        hint={<KeyHint keys="mod+K" />}
      />

      {/* sim clock */}
      <div className="hidden items-center gap-2.5 rounded-sm border border-line bg-sunken px-2.5 py-1 md:flex">
        <div className="text-right">
          <div className="font-mono text-[9.5px] leading-tight tracking-[0.1em] text-ink-faint uppercase">
            {stamp}
          </div>
          <div className="font-mono text-[13px] leading-tight font-medium tabular-nums text-ink">
            {time}
            <span className="ml-1 text-[9px] text-ink-faint">IST</span>
          </div>
        </div>
        <span
          className={cx(
            "h-1.5 w-1.5 rounded-full",
            speed === "0" ? "bg-idle" : "animate-pulse bg-ok",
          )}
          aria-hidden="true"
        />
      </div>

      <SegmentedControl
        label="Simulation speed"
        size="sm"
        options={SPEEDS.map((s) => ({ value: s.value, label: s.label, title: s.title }))}
        value={speed}
        onChange={(v) => setSpeed(v as Speed)}
      />

      <Tooltip label="4 unread alerts" side="bottom">
        <IconButton label="Alerts" size="sm" className="relative">
          <IconBell size={16} />
          <Badge
            tone="crit"
            className="absolute -top-1 -right-1 h-[15px] min-w-[15px] px-1 text-[9.5px]"
          >
            4
          </Badge>
        </IconButton>
      </Tooltip>
    </header>
  );
}
