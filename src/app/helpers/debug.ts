import { armoryAdd } from '@helpers/armory';
import { monsterEncounters, monsterRecordKill } from '@helpers/bestiary';
import { collectiblesAdd } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import { addMaterial } from '@helpers/materials';
import {
  CHARACTER_MAX_LEVEL,
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/party';
import { isRecipeDropGated, recipeDiscover } from '@helpers/recipes';
import { researchForfeitActiveWithRefund } from '@helpers/research/research';
import {
  TRADESKILL_MAX_LEVEL,
  tradeskillBuildingIn,
  tradeskillIdForName,
  tradeskillXpForLevel,
} from '@helpers/tradeskill';
import { updateGamestate } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import {
  worldNodeDiscover,
  worldNodeUndiscover,
} from '@helpers/world-node-discovery';
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
  Tradeskill,
} from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function debugToggle() {
  setOption('showDebug', true);
}

// Manual recovery escape hatch for the active research node - refunds
// whatever was paid and resets to Idle, same behavior as the
// removed-content path in retrofitResearch (research.ts). Cheap insurance
// for any desync shape the automatic migration didn't anticipate.
export function debugResetResearch(): void {
  researchForfeitActiveWithRefund();
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

// Records a kill for every monster at every node it can be fought in, at
// that node's level range, so the bestiary shows real stat spreads instead
// of needing to fight everything manually. Monsters authored nowhere fall
// back to a single level-1 kill so they still show up.
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

export function debugDiscoverWorldNode(nodeName: string): void {
  worldNodeDiscover(nodeName);
}

export function debugUndiscoverWorldNode(nodeName: string): void {
  worldNodeUndiscover(nodeName);
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
