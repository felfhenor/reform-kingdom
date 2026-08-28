import { tileIsOnPath } from '@helpers/pathfinding/pathfinding';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import type { CurrentLocation, TravelStep } from '@interfaces';
import { sum } from 'es-toolkit/compat';

// Split out of travel.ts so this pure tick-costing math stays free of its gameplay side effects.

export const TICKS_PER_STEP_ON_PATH = 1;
export const TICKS_PER_STEP_OFF_PATH = 3;

// A node's own tile counts as "on path" so arriving doesn't stutter with the off-path cost.
function travelTileCountsAsPath(
  mapName: string,
  x: number,
  y: number,
): boolean {
  return tileIsOnPath(mapName, x, y) || !!worldNodeAt(mapName, x, y);
}

// Teleport is instant. Move is cheap entering a path/node tile, or leaving a node tile -
// leaving an ordinary path tile is deliberately not discounted, or the off-path cost would never apply.
export function travelStepTicksCost(
  step: TravelStep,
  originTile: CurrentLocation,
): number {
  if (step.kind === 'Teleport') return 0;

  const enteringPathOrNode = travelTileCountsAsPath(
    step.mapName,
    step.x,
    step.y,
  );
  const exitingNode = !!worldNodeAt(
    originTile.mapName,
    originTile.x,
    originTile.y,
  );

  return enteringPathOrNode || exitingNode
    ? TICKS_PER_STEP_ON_PATH
    : TICKS_PER_STEP_OFF_PATH;
}

// Sums a path's tick cost, threading each completed step as the next origin - mirrors the
// per-step costing `travelProcessTick` does live, resolved all at once for a non-ticking location.
export function travelPathTotalTicks(
  path: TravelStep[],
  origin: CurrentLocation,
): number {
  let originTile = origin;
  const costs = path.map((step) => {
    const cost = travelStepTicksCost(step, originTile);
    originTile = { mapName: step.mapName, x: step.x, y: step.y };
    return cost;
  });

  return sum(costs);
}
