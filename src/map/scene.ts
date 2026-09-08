import { NODES } from "../domain/nodes";
import { LANES } from "../domain/lanes";
import { project, type View } from "./projection";
import { routeFor } from "./route";
import type { PaletteSource } from "./fleet";

/* Corridors and nodes, drawn on the canvas alongside the fleet.

   They live here rather than in SVG because both need a constant screen size
   under zoom — a node dot should stay 4 px whether you are looking at the
   whole country or one district, and that is awkward to express in a scaled
   SVG group but free on canvas. */

const NODE_POINTS = NODES.map((n) => ({ node: n, p: project(n.lat, n.lng) }));

const LANE_PATHS = LANES.map((lane) => ({
  id: lane.id,
  world: routeFor(lane.id).world,
}));

export interface LaneHeat {
  /** Mean delay hours on the corridor, or null when nothing is running on it. */
  get(laneId: string): number | null;
}

export function drawLanes(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: PaletteSource,
  options: { heat: LaneHeat | null; width: number; height: number },
): void {
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const lane of LANE_PATHS) {
    const delay = options.heat?.get(lane.id) ?? null;

    if (delay === null) {
      ctx.strokeStyle = palette.info;
      ctx.globalAlpha = 0.1;
    } else if (delay >= 6) {
      ctx.strokeStyle = palette.crit;
      ctx.globalAlpha = 0.55;
    } else if (delay >= 2) {
      ctx.strokeStyle = palette.warn;
      ctx.globalAlpha = 0.5;
    } else {
      ctx.strokeStyle = palette.ok;
      ctx.globalAlpha = 0.3;
    }

    ctx.beginPath();
    for (let i = 0; i < lane.world.length; i++) {
      const x = lane.world[i].x * view.k + view.tx;
      const y = lane.world[i].y * view.k + view.ty;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

export function drawNodes(
  ctx: CanvasRenderingContext2D,
  view: View,
  palette: PaletteSource,
  options: { width: number; height: number; labels: boolean },
): void {
  ctx.lineWidth = 1;

  for (const { node, p } of NODE_POINTS) {
    const x = p.x * view.k + view.tx;
    const y = p.y * view.k + view.ty;
    if (x < -20 || y < -20 || x > options.width + 20 || y > options.height + 20) continue;

    const isGateway = node.type === "port";
    const r = isGateway ? 3.4 : 2.6;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.strokeStyle = isGateway ? palette.info : palette.ink;
    ctx.globalAlpha = isGateway ? 0.8 : 0.42;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (!options.labels) return;

  ctx.font = "500 10px 'IBM Plex Sans', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.62;

  for (const { node, p } of NODE_POINTS) {
    const x = p.x * view.k + view.tx;
    const y = p.y * view.k + view.ty;
    if (x < 0 || y < 0 || x > options.width || y > options.height) continue;
    ctx.fillText(node.name, x + 6, y);
  }
  ctx.globalAlpha = 1;
}
