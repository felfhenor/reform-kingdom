import { isTraderDiscovered } from '@helpers/caravan/caravan';
import { getEntriesByType } from '@helpers/content/content';
import { isTownVisited } from '@helpers/town/town-visit';
import { isWorldNodeMapVisited } from '@helpers/world-node/world-nodes';
import type {
  CaravanTraderContent,
  CollectibleSource,
  EncounterContent,
  RecipeId,
} from '@interfaces';
import { uniqBy } from 'es-toolkit/compat';

export function recipeSources(recipeId: RecipeId): CollectibleSource[] {
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const traders = getEntriesByType<CaravanTraderContent>('caravantrader');

  const dropEncounters = encounters.filter((encounter) =>
    encounter.completionRewards.some(
      (reward) => 'recipeId' in reward && reward.recipeId === recipeId,
    ),
  );
  const dropSources: CollectibleSource[] = uniqBy(dropEncounters, 'name').map(
    (encounter) => ({ type: 'node', name: encounter.name }),
  );

  const traderSources: CollectibleSource[] = traders
    .filter(
      (trader) =>
        trader.trades.some((trade) => trade.recipeId === recipeId) ||
        trader.tokenTrades.some((trade) => trade.recipeId === recipeId),
    )
    .map((trader) => ({
      type: 'trader',
      traderId: trader.id,
      name: trader.name,
    }));

  return [...dropSources, ...traderSources];
}

// Whether the player has been where this source is, so naming it can't spoil anything.
export function isCollectibleSourceKnown(source: CollectibleSource): boolean {
  switch (source.type) {
    case 'node':
      return isWorldNodeMapVisited(source.name);
    case 'trader':
      return isTraderDiscovered(source.traderId);
    case 'raid':
      return isTownVisited(source.townId);
    case 'crafting':
      return true;
  }
}
