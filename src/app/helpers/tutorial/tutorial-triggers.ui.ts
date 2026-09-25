import { getEntry } from '@helpers/content/content';
import { partyMaxLevel } from '@helpers/item/gathering';
import { isInfusionMaterial } from '@helpers/item/infusion';
import { isAnyTrainerDiscovered } from '@helpers/trainer/trainer';
import {
  discoveredCaravansState,
  discoveredMaterialsState,
  discoveredWorkersState,
  worldTownsState,
} from '@helpers/state-game';
import type { ItemContent, ItemId, TutorialTrigger } from '@interfaces';

export function tutorialTriggerSatisfied(trigger: TutorialTrigger): boolean {
  switch (trigger.kind) {
    case 'game-start':
      return true;
    case 'first-worker':
      return Object.keys(discoveredWorkersState()).length > 0;
    case 'first-infusion-material':
      return Object.keys(discoveredMaterialsState()).some((id) => {
        const item = getEntry<ItemContent>(id as ItemId);
        return !!item && isInfusionMaterial(item);
      });
    case 'party-level':
      return partyMaxLevel() >= trigger.level;
    case 'first-town-visit':
      return Object.values(worldTownsState()).some(
        (town) => town.firstVisitedAtTick !== undefined,
      );
    case 'first-caravan-visit':
      return Object.keys(discoveredCaravansState()).length > 0;
    case 'first-trainer-visit':
      return isAnyTrainerDiscovered();
  }
}
