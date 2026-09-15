import { LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL } from '@helpers/config';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  DropRarity,
  EquipmentItemType,
  LootFilterSettings,
} from '@interfaces';

export function lootFilterSettings(): LootFilterSettings {
  return gamestate().lootFilters;
}

export function isLootFilterActive(filters: LootFilterSettings): boolean {
  const allRaritiesKept = Object.values(filters.keepRarities).every(Boolean);
  const allTypesKept = Object.values(filters.keepEquipmentTypes).every(Boolean);

  return (
    !allRaritiesKept ||
    !allTypesKept ||
    filters.minimumItemLevel > LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL
  );
}

export function lootFilterSetRarityKept(
  rarity: DropRarity,
  keep: boolean,
): void {
  updateGamestate((state) => {
    state.lootFilters.keepRarities[rarity] = keep;
    return state;
  });
}

export function lootFilterSetEquipmentTypeKept(
  type: EquipmentItemType,
  keep: boolean,
): void {
  updateGamestate((state) => {
    state.lootFilters.keepEquipmentTypes[type] = keep;
    return state;
  });
}

export function lootFilterSetMinimumItemLevel(level: number): void {
  updateGamestate((state) => {
    state.lootFilters.minimumItemLevel = Math.floor(Math.max(1, level));
    return state;
  });
}
