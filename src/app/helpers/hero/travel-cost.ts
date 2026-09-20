import { globalEffectSums } from '@helpers/hero/global-effects';
import {
  travelPathSumTicks,
  travelStepTicksCostWithBonus,
} from '@helpers/hero/travel-cost-base';
import type { CurrentLocation, TravelStep } from '@interfaces';

export function travelStepTicksCost(
  step: TravelStep,
  originTile: CurrentLocation,
): number {
  const { onPathTravelSpeedBonus, offPathTravelSpeedBonus } =
    globalEffectSums();

  return travelStepTicksCostWithBonus(
    step,
    originTile,
    onPathTravelSpeedBonus,
    offPathTravelSpeedBonus,
  );
}

export function travelPathTotalTicks(
  path: TravelStep[],
  origin: CurrentLocation,
): number {
  return travelPathSumTicks(path, origin, travelStepTicksCost);
}
