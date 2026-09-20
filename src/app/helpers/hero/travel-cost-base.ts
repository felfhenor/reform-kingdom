import {
  TICKS_PER_STEP_MIN_DIFF,
  TICKS_PER_STEP_OFF_PATH,
  TICKS_PER_STEP_ON_PATH,
} from '@helpers/config';
import { tileIsOnPath } from '@helpers/pathfinding/pathfinding';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import type { CurrentLocation, TravelStep } from '@interfaces';
import { sum } from 'es-toolkit/compat';

// Content-only (no gamestate/global effects) so CLI analysis scripts can import it.

// A node's own tile counts as "on path" so arriving doesn't stutter with the off-path cost.
function travelTileCountsAsPath(
  mapName: string,
  x: number,
  y: number,
): boolean {
  return tileIsOnPath(mapName, x, y) || !!worldNodeAt(mapName, x, y);
}

function reducedStepTicksCost(
  baseTicks: number,
  reduction: number,
  floor: number,
): number {
  return Math.max(floor, baseTicks * (1 - reduction));
}

// Teleport is instant. Move is cheap entering a path/node tile, or leaving a node tile -
// leaving an ordinary path tile is deliberately not discounted, or the off-path cost would never apply.
export function travelStepTicksCostWithBonus(
  step: TravelStep,
  originTile: CurrentLocation,
  onPathBonus: number,
  offPathBonus: number,
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
    ? reducedStepTicksCost(
        TICKS_PER_STEP_ON_PATH,
        onPathBonus,
        TICKS_PER_STEP_MIN_DIFF,
      )
    : reducedStepTicksCost(
        TICKS_PER_STEP_OFF_PATH,
        offPathBonus,
        TICKS_PER_STEP_ON_PATH + TICKS_PER_STEP_MIN_DIFF,
      );
}

// Gates/routing use this so they don't swing with a timed buff.
export function travelStepBaseTicksCost(
  step: TravelStep,
  originTile: CurrentLocation,
): number {
  return travelStepTicksCostWithBonus(step, originTile, 0, 0);
}

// Sums a path's tick cost, threading each completed step as the next origin - mirrors the
// per-step costing done live, resolved all at once for a non-ticking location.
export function travelPathSumTicks(
  path: TravelStep[],
  origin: CurrentLocation,
  stepCost: (step: TravelStep, originTile: CurrentLocation) => number,
): number {
  let originTile = origin;
  const costs = path.map((step) => {
    const cost = stepCost(step, originTile);
    originTile = { mapName: step.mapName, x: step.x, y: step.y };
    return cost;
  });

  return sum(costs);
}

export function travelPathBaseTotalTicks(
  path: TravelStep[],
  origin: CurrentLocation,
): number {
  return travelPathSumTicks(path, origin, travelStepBaseTicksCost);
}
