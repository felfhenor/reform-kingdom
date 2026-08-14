import { getCollectibleQuantity, isCollectibleDiscovered } from '@helpers/collectibles';
import { getCollectibleSource } from '@helpers/collectible-source';
import { getEntriesByType } from '@helpers/content';
import {
  getRecipeFoundAtNode,
  isRecipeDiscovered,
} from '@helpers/recipes';
import { worldNodeDisplayName } from '@helpers/world-nodes';
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

// Every collectible in the game, discovered or not - undiscovered entries
// are still returned (with `quantity: 0`) so the museum can render them as
// silhouettes rather than omitting them entirely. A collectible's source is
// derived fresh from content every call (see `getCollectibleSource`), not
// tracked per-player, so this always reflects the current content even for
// old saves.
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
      return !!entry.source &&
        collectibleSourceName(entry.source).toLowerCase().includes(text);
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

// The nodes an as-yet-undiscovered recipe can drop from, mirroring
// `collectibleSourceNodeNames` - recipes don't know their own source node
// until a copy has actually been found.
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

// Only recipes that can actually be found as a world drop are museum-worthy
// - a recipe with no source node (only ever learned by leveling a
// tradeskill building) is excluded entirely rather than shown as an
// always-undiscovered silhouette.
export function getMuseumRecipeEntries(): MuseumRecipeEntry[] {
  const recipes = getEntriesByType<RecipeContent>('recipe');

  const entries = recipes
    .map((recipe) => {
      const discovered = isRecipeDiscovered(recipe.id);
      const foundAtNode = getRecipeFoundAtNode(recipe.id);

      return {
        recipe,
        discovered,
        foundAtNode: foundAtNode ? worldNodeDisplayName(foundAtNode) : undefined,
        sourceNodeNames: discovered
          ? []
          : recipeSourceNodeNames(recipe.id).map(worldNodeDisplayName),
      };
    })
    .filter((entry) => entry.discovered || entry.sourceNodeNames.length > 0);

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
    if (!entry.discovered) {
      return entry.sourceNodeNames.some((name) =>
        name.toLowerCase().includes(text),
      );
    }

    if (entry.recipe.name.toLowerCase().includes(text)) return true;
    if (entry.foundAtNode?.toLowerCase().includes(text)) return true;

    return false;
  });
}
