import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { useDensity, useTheme } from "../lib/prefs";
import { Tooltip } from "../ui";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDecarbonize,
  IconDensity,
  IconExecute,
  IconLayers,
  IconMoon,
  IconProcure,
  IconPulse,
  IconSettle,
  IconSun,
  IconTrack,
  IconUser,
  MarkControlTower,
} from "../ui/icons";
import { isActive, Link, useLocation } from "./router";

/* The six FreightFox modules. Track and Pulse are what this build implements;
   the other four are shown as real destinations that explain themselves rather
   than being hidden, because the module set is the product's shape. */

type Module = {
  path: string;
  label: string;
  icon: (p: { size?: number; className?: string }) => ReactNode;
  built: boolean;
};

export const MODULES: Module[] = [
  { path: "/procure", label: "Procure", icon: IconProcure, built: false },
  { path: "/execute", label: "Execute", icon: IconExecute, built: false },
  { path: "/track", label: "Track", icon: IconTrack, built: true },
  { path: "/settle", label: "Settle", icon: IconSettle, built: false },
  { path: "/pulse", label: "Pulse", icon: IconPulse, built: true },
  { path: "/decarbonize", label: "Decarbonize", icon: IconDecarbonize, built: false },
];

function RailItem({
  path,
  label,
  icon: Icon,
  built,
  collapsed,
  current,
}: Module & { collapsed: boolean; current: boolean }) {
  const body = (
    <Link
      to={path}
      aria-current={current ? "page" : undefined}
      className={cx(
        "group relative flex h-9 items-center gap-2.5 rounded-sm px-2.5 transition-colors",
        current
          ? "bg-accent-soft text-accent"
          : "text-ink-mute hover:bg-hover hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      {current && (
        <span className="absolute top-1.5 -left-2 bottom-1.5 w-[2px] rounded-full bg-accent" />
      )}
      <Icon size={17} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-[13px] font-medium">{label}</span>
          {!built && (
            <span
              className="h-1 w-1 shrink-0 rounded-full bg-ink-faint"
              title="Not part of this build"
            />
          )}
        </>
      )}
    </Link>
  );

  return collapsed ? (
    <Tooltip label={label} side="bottom" className="block">
      {body}
    </Tooltip>
  ) : (
    body
  );
}

export function Rail({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const path = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { density, toggle: toggleDensity } = useDensity();

  return (
    <nav
      aria-label="Modules"
      className={cx(
        "flex shrink-0 flex-col border-r border-line bg-sunken transition-[width] duration-150",
        collapsed ? "w-[56px]" : "w-[212px]",
      )}
    >
      {/* brand */}
      <div
        className={cx(
          "flex h-12 shrink-0 items-center gap-2 border-b border-line px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="text-accent">
          <MarkControlTower size={21} />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] leading-tight font-semibold tracking-tight text-ink">
              Control Tower
            </div>
            <div className="truncate font-mono text-[9.5px] tracking-[0.12em] text-ink-faint uppercase">
              Freight ops
            </div>
          </div>
        )}
      </div>

      {/* modules */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {MODULES.map((m) => (
          <RailItem
            key={m.path}
            {...m}
            collapsed={collapsed}
            current={isActive(m.path, path)}
          />
        ))}

        <div className="my-2 h-px bg-line" />

        <RailItem
          path="/system"
          label="Design system"
          icon={IconLayers}
          built
          collapsed={collapsed}
          current={isActive("/system", path)}
        />
      </div>

      {/* viewing preferences */}
      <div
        className={cx(
          "flex shrink-0 flex-col gap-0.5 border-t border-line p-2",
          collapsed && "items-center",
        )}
      >
        <button
          type="button"
          onClick={toggleTheme}
          className={cx(
            "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-ink-mute transition-colors hover:bg-hover hover:text-ink",
            collapsed && "w-9 justify-center px-0",
          )}
          title={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          {!collapsed && (
            <span className="text-[12.5px]">{theme === "dark" ? "Light" : "Dark"}</span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleDensity}
          className={cx(
            "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-ink-mute transition-colors hover:bg-hover hover:text-ink",
            collapsed && "w-9 justify-center px-0",
          )}
          title={`Density: ${density}`}
        >
          <IconDensity size={16} />
          {!collapsed && <span className="text-[12.5px] capitalize">{density}</span>}
        </button>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cx(
            "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-ink-mute transition-colors hover:bg-hover hover:text-ink",
            collapsed && "w-9 justify-center px-0",
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          {!collapsed && <span className="text-[12.5px]">Collapse</span>}
        </button>

        <div className="my-1 h-px bg-line" />

        <div
          className={cx(
            "flex h-9 items-center gap-2.5 px-2.5",
            collapsed && "justify-center px-0",
          )}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line-strong bg-panel text-ink-mute">
            <IconUser size={13} />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[12px] leading-tight font-medium text-ink-soft">
                A. Raman
              </div>
              <div className="truncate text-[10.5px] text-ink-faint">
                Control tower lead
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
