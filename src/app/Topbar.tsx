import { cx } from "../lib/cx";
import { SPEEDS, type Speed } from "../sim/clock";
import { simStore, useSim } from "../store/simStore";
import { Badge, IconButton, KeyHint, SegmentedControl, Tooltip } from "../ui";
import { IconBell, IconChevronDown, IconSearch } from "../ui/icons";
import { OPEN_PALETTE } from "../features/track/paletteBus";

const SPEED_LABEL: Record<Speed, string> = {
  0: "❙❙",
  1: "1×",
  60: "60×",
  600: "600×",
};

const SPEED_TITLE: Record<Speed, string> = {
  0: "Paused",
  1: "Real time",
  60: "One minute per second",
  600: "Ten minutes per second",
};

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { now, speed, queue } = useSim();

  const parts = IST.formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const stamp = `${get("weekday")} ${get("day")} ${get("month")}`;
  const time = `${get("hour")}:${get("minute")}`;

  const critical = queue.reduce(
    (n, q) => (q.exception.severity === "critical" ? n + 1 : n),
    0,
  );

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

      <div className="min-w-0">
        <h1 className="truncate text-[13.5px] leading-tight font-semibold text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-[11px] leading-tight text-ink-mute">{subtitle}</p>
        )}
      </div>

      <div className="flex-1" />

      {/* Opens the command palette rather than being a second search box.
          The board already has a filter field; two inputs that look alike but
          do different things is how people end up typing into the wrong one. */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE))}
        className="hidden h-8.5 w-[280px] items-center gap-2 rounded-sm border border-line bg-panel px-2.5 text-left transition-colors hover:border-line-strong hover:bg-hover lg:flex"
      >
        <IconSearch size={15} className="shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-faint">
          Jump to a trip, transporter or view
        </span>
        <KeyHint keys="mod+K" />
      </button>

      {/* simulation clock */}
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
            speed === 0 ? "bg-idle" : "animate-pulse bg-ok",
          )}
          aria-hidden="true"
        />
      </div>

      <SegmentedControl
        label="Simulation speed"
        size="sm"
        options={SPEEDS.map((s) => ({
          value: String(s),
          label: SPEED_LABEL[s],
          title: SPEED_TITLE[s],
        }))}
        value={String(speed)}
        onChange={(v) => simStore.setSpeed(Number(v) as Speed)}
      />

      <Tooltip
        label={critical === 0 ? "No critical exceptions" : `${critical} critical`}
        side="bottom"
      >
        <IconButton label="Alerts" size="sm" className="relative">
          <IconBell size={16} />
          {critical > 0 && (
            <Badge
              tone="crit"
              className="absolute -top-1 -right-1 h-[15px] min-w-[15px] px-1 text-[9.5px]"
            >
              {critical}
            </Badge>
          )}
        </IconButton>
      </Tooltip>
    </header>
  );
}
