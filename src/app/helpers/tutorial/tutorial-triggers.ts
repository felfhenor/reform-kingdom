import { partyFirstBurstSkillHero } from '@helpers/hero/job';
import { partyMaxLevel } from '@helpers/item/gathering';
import { isInfusionUnlocked } from '@helpers/item/infusion';
import { isReforgeUnlocked } from '@helpers/item/reforge';
import { isAnyTrainerDiscovered } from '@helpers/trainer/trainer';
import {
  discoveredCaravansState,
  discoveredWorkersState,
  worldAutoModeState,
  worldPartyState,
  worldTownsState,
} from '@helpers/state-game';
import type { TutorialTrigger } from '@interfaces';
import { sum } from 'es-toolkit';

export function tutorialTriggerSatisfied(trigger: TutorialTrigger): boolean {
  switch (trigger.kind) {
    case 'game-start':
      return true;
    case 'first-worker':
      return Object.keys(discoveredWorkersState()).length > 0;
    case 'first-infusion-material':
      return isInfusionUnlocked();
    case 'first-reforge-reagent':
      return isReforgeUnlocked();
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
    case 'first-burst-skill':
      return !!partyFirstBurstSkillHero(worldPartyState());
    case 'losing-streak':
      return (
        partyMaxLevel() < trigger.belowLevel &&
        recentLossCount() >= trigger.losses
      );
  }
}

// Node failure counts clear on a win there or on level-up, so this is losses since the party last made progress.
function recentLossCount(): number {
  return sum(
    Object.values(worldAutoModeState().nodeFailureCounts).map((n) => n ?? 0),
  );
}
