import { getEntriesByType } from '@helpers/content/content';
import {
  isRecipeDiscovered,
  isRecipeDropGated,
} from '@helpers/crafting/recipes';
import { getCollectibleSource } from '@helpers/item/collectible-source';
import {
  getCollectibleQuantity,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import {
  isCollectibleSourceKnown,
  recipeSources,
} from '@helpers/kingdom/museum';
import { worldNodeDisplayName } from '@helpers/world-node/world-nodes';
import type {
  CollectibleContent,
  CollectibleId,
  CollectibleSource,
  MuseumCollectibleEntry,
  MuseumRecipeEntry,
  RecipeContent,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

const CRAFTING_SOURCE_NAME = 'Crafting';
const UNMET_TRADER_NAME = 'an unmet trader';

// Includes undiscovered collectibles (quantity: 0) so the museum can render them as silhouettes.
export function getMuseumCollectibleEntries(): MuseumCollectibleEntry[] {
  const collectibles = getEntriesByType<CollectibleContent>('collectible');

  const entries = collectibles.map((collectible) => {
    const discovered = isCollectibleDiscovered(collectible.id);

    return {
      collectible,
      discovered,
      quantity: getCollectibleQuantity(collectible.id),
      source: museumCollectibleSource(collectible.id, discovered),
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

// Undiscovered recipes only list sources the player has already found.
export function recipeSourceNames(
  recipe: RecipeContent,
  discovered: boolean,
): string[] {
  return recipeSources(recipe.id)
    .filter((source) => discovered || isCollectibleSourceKnown(source))
    .map((source) =>
      source.type === 'node'
        ? worldNodeDisplayName(source.name)
        : collectibleSourceName(source),
    );
}

export function recipeKnownSourceNames(recipe: RecipeContent): string[] {
  return recipeSourceNames(recipe, isRecipeDiscovered(recipe.id));
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
      sourceNodeNames: recipeSourceNames(recipe, discovered),
      tokenUnlockCost: discovered ? undefined : recipe.tokenUnlockCost,
    };
  });

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
