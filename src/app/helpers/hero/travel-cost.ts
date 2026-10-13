import { jobAbilityValue } from '@helpers/hero/job-ability';
import { globalEffectSumsState } from '@helpers/state-game';
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
    globalEffectSumsState();

  return travelStepTicksCostWithBonus(
    step,
    originTile,
    onPathTravelSpeedBonus + jobAbilityValue('OnPathTravelSpeed'),
    offPathTravelSpeedBonus + jobAbilityValue('OffPathTravelSpeed'),
  );
}

export function travelPathTotalTicks(
  path: TravelStep[],
  origin: CurrentLocation,
): number {
  return travelPathSumTicks(path, origin, travelStepTicksCost);
}
