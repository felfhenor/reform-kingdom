import { armoryAdd } from '@helpers/armory';
import { collectiblesAdd } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import { TRADESKILL_MAX_LEVEL, tradeskillXpForLevel } from '@helpers/crafting';
import { addMaterial } from '@helpers/materials';
import {
  CHARACTER_MAX_LEVEL,
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/party';
import { updateGamestate } from '@helpers/state-game';
import { setOption } from '@helpers/state-options';
import type {
  CharacterId,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  Tradeskill,
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
  const clampedLevel = clamp(Math.round(level), 1, TRADESKILL_MAX_LEVEL);

  updateGamestate((state) => {
    state.tradeskills[tradeskill] = {
      ...state.tradeskills[tradeskill],
      level: clampedLevel,
      xp: { current: 0, maximum: tradeskillXpForLevel(clampedLevel) },
    };

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
