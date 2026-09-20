import {
  travelPathTotalTicks,
  travelStepTicksCost,
} from '@helpers/hero/travel-cost';
import type {
  CurrentLocation,
  PathAdvanceResult,
  TravelStep,
} from '@interfaces';

// Absorbs float error so a step that is exactly paid for never slips a tick.
const TRAVEL_PROGRESS_EPSILON = 1e-9;

export function travelProgressCovers(progress: number, cost: number): boolean {
  return cost <= 0 || progress + TRAVEL_PROGRESS_EPSILON >= cost;
}

// Surplus progress carries into the next step, so fractional step costs average out over a path.
export function travelProgressSurplus(progress: number, cost: number): number {
  return Math.max(0, progress - cost);
}

// One tick of progress, spent across as many steps as it covers (0-cost Teleports chain).
export function travelPathAdvanceTick(
  path: TravelStep[],
  ticksIntoStep: number,
  location: CurrentLocation,
): PathAdvanceResult {
  let remaining = path;
  let position = location;
  let progress = ticksIntoStep + 1;

  while (remaining.length > 0) {
    const [step, ...rest] = remaining;
    const cost = travelStepTicksCost(step, position);
    if (!travelProgressCovers(progress, cost)) break;

    progress = travelProgressSurplus(progress, cost);
    position = { mapName: step.mapName, x: step.x, y: step.y };
    remaining = rest;
  }

  if (remaining.length === 0) return { arrived: true, location: position };

  return {
    arrived: false,
    path: remaining,
    ticksIntoStep: progress,
    location: position,
  };
}

// Arrival is the first whole tick covering what's left, so round up; a non-empty path takes at least one.
export function travelTicksRemaining(
  path: TravelStep[],
  origin: CurrentLocation,
  ticksIntoStep = 0,
): number {
  const remaining = travelPathTotalTicks(path, origin) - ticksIntoStep;
  const ticks = Math.ceil(remaining - TRAVEL_PROGRESS_EPSILON);
  return Math.max(path.length > 0 ? 1 : 0, ticks);
}
