import { getEntriesByType } from '@helpers/content';
import {
  isRecipeDiscovered,
  isRecipeDropGated,
} from '@helpers/crafting/recipes';
import { getCollectibleSource } from '@helpers/item/collectible-source';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { worldNodeDisplayName } from '@helpers/world-node/world-nodes';
import type {
  CollectibleContent,
  CollectibleSource,
  EncounterContent,
  MuseumCollectibleEntry,
  MuseumRecipeEntry,
  RecipeContent,
  RecipeId,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

const CRAFTING_SOURCE_NAME = 'Crafting';

// Includes undiscovered collectibles (quantity: 0) so the museum can render them as silhouettes.
export function getMuseumCollectibleEntries(): MuseumCollectibleEntry[] {
  const collectibles = getEntriesByType<CollectibleContent>('collectible');

  const entries = collectibles.map((collectible) => {
    const discovered = isCollectibleDiscovered(collectible.id);
    const rawSource = getCollectibleSource(collectible.id);

    // A node source's name is re-masked through `worldNodeDisplayName` here
    // (rather than cached) since it depends on live world-discovery state.
    const source: CollectibleSource | undefined =
      rawSource?.type === 'node'
        ? { type: 'node', name: worldNodeDisplayName(rawSource.name) }
        : rawSource;

    return {
      collectible,
      discovered,
      quantity: getCollectibleQuantity(collectible.id),
      source,
    };
  });

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

function collectibleSourceName(source: CollectibleSource): string {
  return source.type === 'crafting' ? CRAFTING_SOURCE_NAME : source.name;
}

export function filterMuseumCollectibleEntries(
  entries: MuseumCollectibleEntry[],
  searchText: string,
): MuseumCollectibleEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (!entry.discovered) {
      return (
        !!entry.source &&
        collectibleSourceName(entry.source).toLowerCase().includes(text)
      );
    }

    if (entry.collectible.name.toLowerCase().includes(text)) return true;
    if (entry.collectible.description.toLowerCase().includes(text)) {
      return true;
    }
    if (
      entry.source &&
      collectibleSourceName(entry.source).toLowerCase().includes(text)
    ) {
      return true;
    }

    return false;
  });
}

// Encounters a recipe can drop from - computed live so it can't go stale.
export function recipeSourceNodeNames(recipeId: RecipeId): string[] {
  const encounters = getEntriesByType<EncounterContent>('encounter');

  const names = new Set<string>();
  encounters.forEach((encounter) => {
    const dropsHere = encounter.completionRewards.some(
      (reward) => 'recipeId' in reward && reward.recipeId === recipeId,
    );
    if (dropsHere) names.add(encounter.name);
  });

  return [...names];
}

// Only drop-gated recipes are shown - level-learned recipes have no discovery to track.
export function getMuseumRecipeEntries(): MuseumRecipeEntry[] {
  const recipes = getEntriesByType<RecipeContent>('recipe').filter((recipe) =>
    isRecipeDropGated(recipe.id),
  );

  const entries = recipes.map((recipe) => ({
    recipe,
    discovered: isRecipeDiscovered(recipe.id),
    sourceNodeNames: recipeSourceNodeNames(recipe.id).map(worldNodeDisplayName),
  }));

  return orderBy(
    entries,
    [(entry) => (entry.discovered ? 1 : 0), (entry) => entry.recipe.name],
    ['desc', 'asc'],
  );
}

export function filterMuseumRecipeEntries(
  entries: MuseumRecipeEntry[],
  searchText: string,
): MuseumRecipeEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (entry.discovered && entry.recipe.name.toLowerCase().includes(text)) {
      return true;
    }

    return entry.sourceNodeNames.some((name) =>
      name.toLowerCase().includes(text),
    );
  });
}
