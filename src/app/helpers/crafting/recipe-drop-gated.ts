import { allContentById, getEntriesByType } from '@helpers/content/content';
import type {
  CaravanTraderContent,
  EncounterContent,
  RecipeId,
} from '@interfaces';

// Keyed by the content map, so a content reload is just a cache miss.
const dropGatedCache = new WeakMap<object, Set<RecipeId>>();

function dropGatedRecipeIds(): Set<RecipeId> {
  const content = allContentById();
  const cached = dropGatedCache.get(content);
  if (cached) return cached;

  const fromEncounters = getEntriesByType<EncounterContent>(
    'encounter',
  ).flatMap((encounter) =>
    encounter.completionRewards.flatMap((reward) =>
      'recipeId' in reward ? [reward.recipeId] : [],
    ),
  );
  const fromTraders = getEntriesByType<CaravanTraderContent>(
    'caravantrader',
  ).flatMap((trader) =>
    [...trader.trades, ...trader.tokenTrades].flatMap((trade) =>
      trade.recipeId ? [trade.recipeId] : [],
    ),
  );

  const ids = new Set([...fromEncounters, ...fromTraders]);
  dropGatedCache.set(content, ids);
  return ids;
}

// Whether this recipe is gated behind a world drop or a caravan trader sale -
// gated recipes should never be craftable until discovered.
export function isRecipeDropGated(recipeId: RecipeId): boolean {
  return dropGatedRecipeIds().has(recipeId);
}
