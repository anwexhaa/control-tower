import type { ReactNode } from "react";
import { ControlTowerScaffold } from "../features/track/ControlTowerScaffold";
import { PulseScaffold } from "../features/pulse/PulseScaffold";
import { ModuleStub } from "../features/ModuleStub";
import { DesignSystem } from "../features/system/DesignSystem";
import { matchPath, type Params } from "./router";

export type Route = {
  pattern: string;
  title: string;
  subtitle?: string;
  render: (params: Params) => ReactNode;
};

export const ROUTES: Route[] = [
  {
    pattern: "/track",
    title: "Control tower",
    subtitle: "Live shipment monitoring",
    render: () => <ControlTowerScaffold />,
  },
  {
    // Phase 5 replaces this with the trip detail surface.
    pattern: "/track/:tripId",
    title: "Control tower",
    subtitle: "Trip detail",
    render: () => <ControlTowerScaffold />,
  },
  {
    pattern: "/pulse",
    title: "Pulse",
    subtitle: "Network performance",
    render: () => <PulseScaffold />,
  },
  {
    pattern: "/system",
    title: "Design system",
    subtitle: "Tokens and primitives",
    render: () => <DesignSystem />,
  },
  {
    pattern: "/procure",
    title: "Procure",
    subtitle: "Not in this build",
    render: () => <ModuleStub module="Procure" />,
  },
  {
    pattern: "/execute",
    title: "Execute",
    subtitle: "Not in this build",
    render: () => <ModuleStub module="Execute" />,
  },
  {
    pattern: "/settle",
    title: "Settle",
    subtitle: "Not in this build",
    render: () => <ModuleStub module="Settle" />,
  },
  {
    pattern: "/decarbonize",
    title: "Decarbonize",
    subtitle: "Not in this build",
    render: () => <ModuleStub module="Decarbonize" />,
  },
];

export function resolve(path: string): { route: Route; params: Params } | null {
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}
