import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  isRecipeDiscovered,
  isRecipeDropGated,
} from '@helpers/crafting/recipes';
import { isMaterialDiscovered } from '@helpers/item';
import { getCollectibleSource } from '@helpers/item/collectible-source';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import {
  equipmentSources,
  isCollectibleSourceKnown,
  itemSources,
  recipeSources,
} from '@helpers/kingdom/museum';
import { worldNodeDisplayName } from '@helpers/world-node/world-nodes';
import type {
  CollectibleContent,
  CollectibleId,
  CollectibleSource,
  EquipmentContent,
  ItemContent,
  MuseumCollectibleEntry,
  MuseumDiscoverableMultipleSources,
  MuseumEquipmentEntry,
  MuseumItemEntry,
  MuseumRecipeEntry,
  RecipeContent,
  TradeskillContent,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

const CRAFTING_SOURCE_NAME = 'Crafting';
export const UNMET_TRADER_NAME = 'an unmet trader';

export function museumCollectibleEntry(
  collectible: CollectibleContent,
): MuseumCollectibleEntry {
  const discovered = isCollectibleDiscovered(collectible.id);

  return {
    collectible,
    discovered,
    quantity: getCollectibleQuantity(collectible.id),
    source: museumCollectibleSource(collectible.id, discovered),
  };
}

// Includes undiscovered collectibles (quantity: 0) so the museum can render them as silhouettes.
export function getMuseumCollectibleEntries(): MuseumCollectibleEntry[] {
  const entries = getEntriesByType<CollectibleContent>('collectible').map(
    museumCollectibleEntry,
  );

  return orderBy(
    entries,
    [
      (entry) => (entry.discovered ? 1 : 0),
      (entry) => RARITY_PRIORITY[entry.collectible.rarity],
      (entry) => entry.collectible.name,
    ],
    ['desc', 'desc', 'asc'],
  );
}

// An undiscovered collectible's source stays unknown until its map is visited or its town visited; an unmet trader is hinted at without a name.
function museumCollectibleSource(
  collectibleId: CollectibleId,
  discovered: boolean,
): CollectibleSource | undefined {
  const source = getCollectibleSource(collectibleId);
  if (!source) return undefined;
  if (!discovered && !isCollectibleSourceKnown(source)) {
    return source.type === 'trader'
      ? { ...source, name: UNMET_TRADER_NAME }
      : undefined;
  }
  if (source.type !== 'node') return source;

  return { type: 'node', name: worldNodeDisplayName(source.name) };
}

function collectibleSourceName(source: CollectibleSource): string {
  if (source.type === 'crafting') {
    const tradeskillName =
      getEntry<TradeskillContent>(source.tradeskillId)?.name ?? 'Unknown';

    return `${CRAFTING_SOURCE_NAME} (${tradeskillName} Lv. ${source.tradeskillLevel})`;
  }

  return source.name;
}

export function museumCollectibleSourceLabel({
  source,
}: MuseumCollectibleEntry): string | undefined {
  return collectibleSourceName(source ?? { type: 'node', name: 'Unknown' });
}

function textIncludes(value: string, text: string): boolean {
  return value.toLowerCase().includes(text);
}

// Shared search-box behaviour: trims/lowercases the query and returns everything when it is empty.
function filterMuseumEntries<T>(
  entries: T[],
  searchText: string,
  matches: (entry: T, text: string) => boolean,
): T[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => matches(entry, text));
}

// Undiscovered entries only match on their sources, never their name.
function filterByNameAndSources<T extends MuseumDiscoverableMultipleSources>(
  entries: T[],
  searchText: string,
  name: (entry: T) => string,
): T[] {
  return filterMuseumEntries(
    entries,
    searchText,
    (entry, text) =>
      (entry.discovered && textIncludes(name(entry), text)) ||
      entry.sourceNodeNames.some((sourceName) =>
        textIncludes(sourceName, text),
      ),
  );
}

export function filterMuseumCollectibleEntries(
  entries: MuseumCollectibleEntry[],
  searchText: string,
): MuseumCollectibleEntry[] {
  return filterMuseumEntries(entries, searchText, (entry, text) => {
    if (
      entry.source &&
      textIncludes(collectibleSourceName(entry.source), text)
    ) {
      return true;
    }
    if (!entry.discovered) return false;

    return (
      textIncludes(entry.collectible.name, text) ||
      textIncludes(entry.collectible.description, text)
    );
  });
}

// Undiscovered entries only list sources the player has already found.
function knownSourceNames(
  sources: CollectibleSource[],
  discovered: boolean,
): string[] {
  return sources
    .filter((source) => discovered || isCollectibleSourceKnown(source))
    .map((source) =>
      source.type === 'node'
        ? worldNodeDisplayName(source.name)
        : collectibleSourceName(source),
    );
}

export function recipeKnownSourceNames(recipe: RecipeContent): string[] {
  return knownSourceNames(
    recipeSources(recipe.id),
    isRecipeDiscovered(recipe.id),
  );
}

// Only drop-gated recipes are shown - level-learned recipes have no discovery to track.
export function getMuseumRecipeEntries(): MuseumRecipeEntry[] {
  const recipes = getEntriesByType<RecipeContent>('recipe').filter((recipe) =>
    isRecipeDropGated(recipe.id),
  );

  const entries = recipes.map((recipe) => {
    const discovered = isRecipeDiscovered(recipe.id);

    return {
      recipe,
      discovered,
      sourceNodeNames: knownSourceNames(recipeSources(recipe.id), discovered),
      tokenUnlockCost: discovered ? undefined : recipe.tokenUnlockCost,
    };
  });

  return orderBy(
    entries,
    [(entry) => (entry.discovered ? 1 : 0), (entry) => entry.recipe.name],
    ['desc', 'asc'],
  );
}

export function getMuseumItemEntries(): MuseumItemEntry[] {
  const items = getEntriesByType<ItemContent>('item').filter(
    (i) => !i.unobtainable,
  );

  const entries = items.map((item) => {
    const discovered = isMaterialDiscovered(item.id);

    return {
      item,
      discovered,
      sourceNodeNames: knownSourceNames(itemSources(item.id), discovered),
    };
  });

  return orderBy(
    entries,
    [(entry) => (entry.discovered ? 1 : 0), (entry) => entry.item.name],
    ['desc', 'asc'],
  );
}

export function getMuseumEquipmentEntries(): MuseumEquipmentEntry[] {
  const equipment = getEntriesByType<EquipmentContent>('equipment');

  const entries = equipment.map((item) => {
    const discovered = isEquipmentDiscovered(item.id);

    return {
      equipment: item,
      discovered,
      sourceNodeNames: knownSourceNames(equipmentSources(item.id), discovered),
    };
  });

  return orderBy(
    entries,
    [(entry) => (entry.discovered ? 1 : 0), (entry) => entry.equipment.name],
    ['desc', 'asc'],
  );
}

export function filterMuseumRecipeEntries(
  entries: MuseumRecipeEntry[],
  searchText: string,
): MuseumRecipeEntry[] {
  return filterByNameAndSources(entries, searchText, (e) => e.recipe.name);
}

export function filterMuseumItemEntries(
  entries: MuseumItemEntry[],
  searchText: string,
): MuseumItemEntry[] {
  return filterByNameAndSources(entries, searchText, (e) => e.item.name);
}

export function filterMuseumEquipmentEntries(
  entries: MuseumEquipmentEntry[],
  searchText: string,
): MuseumEquipmentEntry[] {
  return filterByNameAndSources(entries, searchText, (e) => e.equipment.name);
}
