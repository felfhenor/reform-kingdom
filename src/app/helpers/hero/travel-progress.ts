import { TRAVEL_UNITS_PER_TICK } from '@helpers/config';
import { travelStepTicksCost } from '@helpers/hero/travel-cost';
import { travelPathSumTicks } from '@helpers/hero/travel-cost-base';
import type {
  CurrentLocation,
  PathAdvanceResult,
  TravelStep,
} from '@interfaces';

// Progress is counted in whole sub-ticks so carrying fractional costs is exact; saved state stays in plain ticks.
export function travelTicksToUnits(ticks: number): number {
  return Math.round(ticks * TRAVEL_UNITS_PER_TICK);
}

export function travelUnitsToTicks(units: number): number {
  return units / TRAVEL_UNITS_PER_TICK;
}

export function travelStepUnitsCost(
  step: TravelStep,
  originTile: CurrentLocation,
): number {
  return travelTicksToUnits(travelStepTicksCost(step, originTile));
}

// One tick of progress, spent across as many steps as it covers (0-cost Teleports chain).
export function travelPathAdvanceTick(
  path: TravelStep[],
  ticksIntoStep: number,
  location: CurrentLocation,
): PathAdvanceResult {
  let remaining = path;
  let position = location;
  let progress = travelTicksToUnits(ticksIntoStep) + TRAVEL_UNITS_PER_TICK;

  while (remaining.length > 0) {
    const [step, ...rest] = remaining;
    const cost = travelStepUnitsCost(step, position);
    if (progress < cost) break;

    progress -= cost;
    position = { mapName: step.mapName, x: step.x, y: step.y };
    remaining = rest;
  }

  if (remaining.length === 0) return { arrived: true, location: position };

  return {
    arrived: false,
    path: remaining,
    ticksIntoStep: travelUnitsToTicks(progress),
    location: position,
  };
}

// Arrival is the first whole tick covering what's left, so round up; a non-empty path takes at least one.
export function travelTicksRemaining(
  path: TravelStep[],
  origin: CurrentLocation,
  ticksIntoStep = 0,
): number {
  const totalUnits = travelPathSumTicks(path, origin, travelStepUnitsCost);
  const remainingUnits = totalUnits - travelTicksToUnits(ticksIntoStep);
  const ticks = Math.ceil(remainingUnits / TRAVEL_UNITS_PER_TICK);

  return Math.max(path.length > 0 ? 1 : 0, ticks);
}
