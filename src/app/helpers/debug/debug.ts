import { getEntriesByType, getEntry } from '@helpers/content';
import {
  isRecipeDropGated,
  recipeDiscover,
  recipeUndiscover,
} from '@helpers/crafting/recipes';
import {
  TRADESKILL_MAX_LEVEL,
  tradeskillBuildingIn,
  tradeskillIdForName,
  tradeskillXpForLevel,
} from '@helpers/crafting/tradeskill';
import {
  CHARACTER_MAX_LEVEL,
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/hero/party';
import { collectiblesAdd } from '@helpers/item/collectibles';
import { gatherNodeDiscover } from '@helpers/item/gather-node-discovery';
import { addMaterial } from '@helpers/item/materials';
import { armoryAdd } from '@helpers/kingdom/armory';
import {
  monsterEncounters,
  monsterRecordKill,
} from '@helpers/kingdom/bestiary';
import { updateGamestate } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import { workerRescue } from '@helpers/worker/worker-discovery';
import {
  WORKER_MAX_LEVEL,
  workerXpForLevel,
} from '@helpers/worker/worker-progression';
import { workerAssign, workerRecall } from '@helpers/worker/worker-travel';
import {
  worldNodeDiscover,
  worldNodeUndiscover,
} from '@helpers/world-node/world-node-discovery';
import type {
  CharacterId,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  MonsterContent,
  RecipeContent,
  RecipeId,
  Tradeskill,
  WorkerContent,
  WorkerId,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function debugToggle() {
  setOption('showDebug', true);
}

export function debugGiveItem(itemId: ItemId, quantity: number): void {
  if (quantity <= 0) return;
  const material = getEntry<ItemContent>(itemId);
  if (!material) {
    console.warn(`Item with ID ${itemId} not found.`);
    return;
  }

  if (material.unobtainable) {
    console.warn(`Item with ID ${itemId} not obtainable.`);
    return;
  }

  addMaterial(material.id, quantity);
}

export function debugGiveAllItems(quantity = 1): void {
  if (quantity <= 0) return;

  getEntriesByType<ItemContent>('item')
    .filter((item) => !item.unobtainable)
    .forEach((item) => {
      addMaterial(item.id, quantity);
    });
}

export function debugGiveEquipment(
  equipmentId: EquipmentId,
  quantity: number,
): void {
  if (quantity <= 0) return;

  const equipment = getEntry<EquipmentContent>(equipmentId);
  if (!equipment) {
    console.warn(`Equipment with ID ${equipmentId} not found.`);
    return;
  }

  if (equipment.unobtainable) {
    console.warn(`Equipment with ID ${equipmentId} not obtainable.`);
    return;
  }

  armoryAdd(equipment.id, quantity);
}

export function debugGiveAllEquipment(quantity = 1): void {
  if (quantity <= 0) return;

  getEntriesByType<EquipmentContent>('equipment')
    .filter((equipment) => !equipment.unobtainable)
    .forEach((equipment) => {
      armoryAdd(equipment.id, quantity);
    });
}

export function debugSetCharacterLevel(
  characterId: CharacterId,
  level: number,
): void {
  const clampedLevel = clamp(Math.round(level), 1, CHARACTER_MAX_LEVEL);

  updateGamestate((state) => {
    state.world.party = state.world.party.map((character) => {
      if (character.id !== characterId) return character;

      const stats = characterStatsForLevel(
        character.jobId,
        clampedLevel,
        character.equipment,
      );

      return {
        ...character,
        level: clampedLevel,
        xp: { current: 0, maximum: characterXpForLevel(clampedLevel) },
        stats,
        hp: clamp(character.hp, 0, stats.Health),
        ep: clamp(character.ep, 0, stats.Energy),
      };
    });

    return state;
  });
}

export function debugSetTradeskillLevel(
  tradeskill: Tradeskill,
  level: number,
): void {
  const tradeskillId = tradeskillIdForName(tradeskill);
  if (!tradeskillId) return;

  const clampedLevel = clamp(Math.round(level), 1, TRADESKILL_MAX_LEVEL);

  updateGamestate((state) => {
    state.tradeskills[tradeskillId] = {
      ...tradeskillBuildingIn(state, tradeskillId),
      level: clampedLevel,
      xp: { current: 0, maximum: tradeskillXpForLevel(clampedLevel) },
    };

    return state;
  });
}

// Wipes every bestiary discovery/kill record - primarily a recovery tool
// for a save whose bestiary data was corrupted by a since-fixed bug (e.g.
// NaN level ranges from before min/max level tracking existed).
export function debugResetBestiary(): void {
  updateGamestate((state) => {
    state.bestiary = {};
    return state;
  });
}

// Records a kill for every monster at every node/level it's fought at, so
// the bestiary shows real stat spreads without fighting everything manually.
export function debugFillBestiary(): void {
  getEntriesByType<MonsterContent>('monster').forEach((monster) => {
    const encounters = monsterEncounters(monster.id);

    if (encounters.length === 0) {
      monsterRecordKill(monster.id, 1);
      return;
    }

    encounters.forEach((encounter) => {
      monsterRecordKill(monster.id, encounter.levelRange.min, encounter.name);
      monsterRecordKill(monster.id, encounter.levelRange.max, encounter.name);
    });
  });
}

// Clears every caravan's commission state so it regenerates on the next
// visit/tick - a recovery tool for a commission stuck blank (see
// `regenerateCommissionNode`'s no-eligible-offer case).
export function debugResetCommissions(): void {
  updateGamestate((state) => {
    state.world.commissions = {};
    return state;
  });
}

export function debugDiscoverWorldNode(nodeName: string): void {
  worldNodeDiscover(nodeName);
}

export function debugUndiscoverWorldNode(nodeName: string): void {
  worldNodeUndiscover(nodeName);
}

// Marks a GatherNode as visited without walking the party there - workers can only be assigned to nodes discovered this way.
export function debugDiscoverGatherNode(nodeName: string): void {
  gatherNodeDiscover(nodeName);
}

// Reverts every hidden node back to undiscovered - a recovery tool for
// testing hidden-node content without needing to click through each one.
export function debugWipeWorldDiscoveries(): void {
  updateGamestate((state) => {
    state.worldDiscoveries = {};
    return state;
  });
}

export function debugGiveCollectible(
  collectibleId: CollectibleId,
  quantity: number,
): void {
  if (quantity <= 0) return;

  const collectible = getEntry<CollectibleContent>(collectibleId);
  if (!collectible) {
    console.warn(`Collectible with ID ${collectibleId} not found.`);
    return;
  }

  if (collectible.unobtainable) {
    console.warn(`Collectible with ID ${collectibleId} not obtainable.`);
    return;
  }

  collectiblesAdd(collectible.id, quantity);
}

// Discovers every drop-gated recipe so it becomes craftable (see
// `isRecipeCraftable`); non-drop-gated recipes need no discovery record.
export function debugDiscoverAllRecipes(): void {
  getEntriesByType<RecipeContent>('recipe')
    .filter((recipe) => isRecipeDropGated(recipe.id))
    .forEach((recipe) => {
      recipeDiscover(recipe.id);
    });
}

// Reverts a single drop-gated recipe back to undiscovered - a testing tool
// for re-triggering discovery/unlock flows without waiting on a real drop.
export function debugUndiscoverRecipe(recipeId: RecipeId): void {
  const recipe = getEntry<RecipeContent>(recipeId);
  if (!recipe) {
    console.warn(`Recipe with ID ${recipeId} not found.`);
    return;
  }

  recipeUndiscover(recipe.id);
}

export function debugRescueWorker(workerId: WorkerId): void {
  const worker = getEntry<WorkerContent>(workerId);
  if (!worker) {
    console.warn(`Worker with ID ${workerId} not found.`);
    return;
  }

  workerRescue(worker.id);
}

// Bypasses the gold cost `workerLevelUp` normally requires - sets xp/level directly.
export function debugSetWorkerLevel(workerId: WorkerId, level: number): void {
  const clampedLevel = clamp(Math.round(level), 1, WORKER_MAX_LEVEL);

  updateGamestate((state) => {
    const worker = state.workers[workerId];
    if (!worker) return state;

    worker.level = clampedLevel;
    worker.xp = { current: 0, maximum: workerXpForLevel(clampedLevel) };
    return state;
  });
}

export function debugAssignWorker(
  workerId: WorkerId,
  nodeName: string,
  itemId: ItemId,
): void {
  if (!workerAssign(workerId, nodeName, itemId)) {
    console.warn(
      `Could not assign worker ${workerId} to ${nodeName} for ${itemId} - not rescued, node not discovered, item not gathered there, or out of stamina range.`,
    );
  }
}

export function debugRecallWorker(workerId: WorkerId): void {
  workerRecall(workerId);
}
