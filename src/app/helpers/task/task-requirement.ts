import { getEntry } from '@helpers/content/content';
import { tradeskillBuildingIn } from '@helpers/crafting/tradeskill';
import { traderTokenId } from '@helpers/item/materials';
import { isTaskRequirementCounter } from '@helpers/task/task';
import { taskStateRequirementSatisfied } from '@helpers/task/task-requirement-state';
import type {
  EncounterContent,
  EncounterRandomContent,
  GameState,
  RecipeContent,
  TaskRequirement,
  TaskRequirementCounter,
} from '@interfaces';

function recipeResultDiscovered(
  state: GameState,
  recipe: RecipeContent,
): boolean {
  const { result } = recipe;
  if ('itemId' in result) return !!state.discoveredMaterials[result.itemId];
  if ('equipmentId' in result) {
    return !!state.discoveredEquipment[result.equipmentId];
  }
  return !!state.collectibles[result.collectibleId];
}

function recipeLikelyCrafted(state: GameState, recipe: RecipeContent): boolean {
  return (
    recipeResultDiscovered(state, recipe) &&
    tradeskillBuildingIn(state, recipe.tradeskillId).level >
      recipe.minTradeskillLevel
  );
}

// A clear is only provable through a guaranteed completion reward; kills alone don't mean the encounter was finished.
function encounterGuaranteedRewardFound(
  state: GameState,
  nodeName: string,
): boolean {
  const encounter = getEntry<EncounterContent | EncounterRandomContent>(
    nodeName,
  );
  return (encounter?.completionRewards ?? []).some((reward) => {
    if (reward.chance < 100) return false;
    if ('collectibleId' in reward)
      return !!state.collectibles[reward.collectibleId];
    if ('workerId' in reward) return !!state.discoveredWorkers[reward.workerId];
    return false;
  });
}

// Counter progress isn't recorded before tasks existed, so older saves are judged from discovery ledgers instead.
export function taskCounterRequirementHasEvidence(
  state: GameState,
  requirement: TaskRequirementCounter,
): boolean {
  switch (requirement.kind) {
    case 'GatherItem':
      return (
        !!state.discoveredGatherNodes[requirement.nodeName] &&
        !!state.discoveredMaterials[requirement.itemId]
      );
    case 'CraftRecipe': {
      const recipe = getEntry<RecipeContent>(requirement.recipeId);
      return !!recipe && recipeLikelyCrafted(state, recipe);
    }
    case 'ClearEncounter':
      return encounterGuaranteedRewardFound(state, requirement.nodeName);
    case 'FulfillCommission':
      return !!state.discoveredMaterials[traderTokenId()];
    case 'CastAstralSpell':
      return state.activeAstralProjectorSpells.some(
        (spell) => spell.astralProjectorId === requirement.astralProjectorId,
      );
  }
}

export function taskRequirementSatisfiedOnLoad(
  state: GameState,
  requirement: TaskRequirement,
): boolean {
  return isTaskRequirementCounter(requirement)
    ? taskCounterRequirementHasEvidence(state, requirement)
    : taskStateRequirementSatisfied(state, requirement);
}
