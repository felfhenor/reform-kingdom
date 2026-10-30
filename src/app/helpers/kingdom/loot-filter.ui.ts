import { LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL } from '@helpers/config';
import { lootFiltersState, updateGamestate } from '@helpers/state-game';
import type {
  DropRarity,
  EquipmentItemType,
  LootFilterSettings,
  LootSource,
} from '@interfaces';

export function lootFilterSettings(): LootFilterSettings {
  return lootFiltersState();
}

export function isLootFilterActive(filters: LootFilterSettings): boolean {
  const anySourceSells = Object.values(filters.sellFromSources).some(Boolean);
  const allRaritiesKept = Object.values(filters.keepRarities).every(Boolean);
  const allTypesKept = Object.values(filters.keepEquipmentTypes).every(Boolean);

  return (
    anySourceSells &&
    (!allRaritiesKept ||
      !allTypesKept ||
      filters.minimumItemLevel > LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL)
  );
}

const andList = new Intl.ListFormat('en', { type: 'conjunction' });
const orList = new Intl.ListFormat('en', { type: 'disjunction' });

function unkept(record: Record<string, boolean>): string[] {
  return Object.keys(record).filter((key) => !record[key]);
}

function lootFilterSoldRules(filters: LootFilterSettings): string[] {
  const types = unkept(filters.keepEquipmentTypes);
  const rarities = unkept(filters.keepRarities);
  const level = filters.minimumItemLevel;

  return [
    ...(types.length > 0 ? [`${andList.format(types)} items`] : []),
    ...(level > LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL
      ? [`anything below level ${level.toLocaleString()}`]
      : []),
    ...(rarities.length > 0 ? [`anything ${orList.format(rarities)}`] : []),
  ].map((x) => x.toLowerCase());
}

export function lootFilterSummary(filters: LootFilterSettings): string {
  if (!isLootFilterActive(filters)) {
    return 'Nothing is automatically sold. Everything found or crafted goes into your armory.';
  }

  const rules = andList.format(lootFilterSoldRules(filters));
  const sources = orList.format(
    Object.entries(filters.sellFromSources)
      .filter(([, sells]) => sells)
      .map(([source]) => source.toLowerCase()),
  );

  return `From ${sources}, ${rules} will be automatically sold.`;
}

export function lootFilterSetSourceSells(
  source: LootSource,
  sell: boolean,
): void {
  updateGamestate((state) => {
    state.lootFilters.sellFromSources[source] = sell;
    return state;
  });
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
    state.lootFilters = {
      ...state.lootFilters,
      minimumItemLevel: Math.floor(Math.max(1, level)),
    };
    return state;
  });
}
