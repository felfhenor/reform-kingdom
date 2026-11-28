import { enumLabel, i18nList, t, tPlural } from '@helpers/i18n/i18n';
import { contentName } from '@helpers/i18n/i18n-content';
import { LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import { lootFiltersState, updateGamestate } from '@helpers/state-game';
import type {
  DropRarity,
  EquipmentContent,
  EquipmentId,
  EquipmentItemType,
  LootFilterSettings,
  LootSource,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

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

function unkept(record: Record<string, boolean>): string[] {
  return Object.keys(record).filter((key) => !record[key]);
}

// Enum labels stay as written, so the summary names each rule the way its toggle does.
function lootFilterSoldRules(filters: LootFilterSettings): string[] {
  const types = unkept(filters.keepEquipmentTypes).map((type) =>
    enumLabel('equipmentType', type),
  );
  const rarities = unkept(filters.keepRarities).map((rarity) =>
    enumLabel('rarity', rarity),
  );
  const level = filters.minimumItemLevel;

  return [
    ...(types.length > 0
      ? [t('lootFilter.ruleTypes', { types: i18nList(types, 'and') })]
      : []),
    ...(level > LOOT_FILTER_DEFAULT_MIN_ITEM_LEVEL
      ? [t('lootFilter.ruleBelowLevel', { level: level.toLocaleString() })]
      : []),
    ...(rarities.length > 0
      ? [t('lootFilter.ruleRarities', { rarities: i18nList(rarities, 'or') })]
      : []),
  ];
}

export function lootFilterSummary(filters: LootFilterSettings): string {
  if (!isLootFilterActive(filters)) return t('lootFilter.nothingSold');

  const sources = Object.entries(filters.sellFromSources)
    .filter(([, sells]) => sells)
    .map(([source]) => enumLabel('lootSource', source));
  const params = {
    sources: i18nList(sources, 'or'),
    rules: i18nList(lootFilterSoldRules(filters), 'and'),
  };
  const exceptions = filters.exceptEquipment.length;

  return exceptions === 0
    ? t('lootFilter.summary', params)
    : tPlural('lootFilter.summaryExcept', exceptions, params);
}

export function lootFilterExceptionOptions(
  filters: LootFilterSettings,
): EquipmentContent[] {
  const options = getEntriesByType<EquipmentContent>('equipment').filter(
    (content) =>
      isEquipmentDiscovered(content.id) &&
      !filters.exceptEquipment.includes(content.id),
  );

  return sortBy(options, (content) => contentName(content));
}

export function lootFilterExceptions(
  filters: LootFilterSettings,
): EquipmentContent[] {
  return filters.exceptEquipment
    .map((id) => getEntry<EquipmentContent>(id))
    .filter((content): content is EquipmentContent => !!content);
}

export function lootFilterAddException(equipmentId: EquipmentId): void {
  updateGamestate((state) => {
    if (state.lootFilters.exceptEquipment.includes(equipmentId)) return state;

    state.lootFilters.exceptEquipment.push(equipmentId);
    return state;
  });
}

export function lootFilterRemoveException(equipmentId: EquipmentId): void {
  updateGamestate((state) => {
    state.lootFilters.exceptEquipment =
      state.lootFilters.exceptEquipment.filter((id) => id !== equipmentId);
    return state;
  });
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
