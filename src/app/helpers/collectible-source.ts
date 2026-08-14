import { computed } from '@angular/core';
import { getEntriesByType } from '@helpers/content';
import { error } from '@helpers/logging';
import type {
  CaravanTraderContent,
  CollectibleId,
  CollectibleSource,
  EncounterContent,
  EncounterRandomContent,
  RecipeContent,
} from '@interfaces';

// Builds the canonical collectible -> source lookup purely from static
// content (encounter/encounterrandom drops, recipe results, trader sells) -
// nothing about a player's actual discovery history factors in, so the
// museum always reflects the current content even for old saves. Each
// collectible is expected to resolve to exactly one source; if authoring
// gives it more than one, that's a content bug and gets logged rather than
// silently resolved.
export function collectibleSourceMapBuild(): Map<
  CollectibleId,
  CollectibleSource[]
> {
  const sources = new Map<CollectibleId, CollectibleSource[]>();

  const addSource = (collectibleId: CollectibleId, source: CollectibleSource) => {
    sources.set(collectibleId, [...(sources.get(collectibleId) ?? []), source]);
  };

  const nodeContents = [
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ];
  nodeContents.forEach((node) => {
    node.completionRewards.forEach((reward) => {
      if ('collectibleId' in reward) {
        addSource(reward.collectibleId, { type: 'node', name: node.name });
      }
    });
  });

  getEntriesByType<RecipeContent>('recipe').forEach((recipe) => {
    if ('collectibleId' in recipe.result) {
      addSource(recipe.result.collectibleId, { type: 'crafting' });
    }
  });

  getEntriesByType<CaravanTraderContent>('caravantrader').forEach((trader) => {
    trader.trades.forEach((trade) => {
      if (trade.type === 'sell' && trade.collectibleId) {
        addSource(trade.collectibleId, { type: 'trader', name: trader.name });
      }
    });
  });

  sources.forEach((collectibleSources, collectibleId) => {
    if (collectibleSources.length > 1) {
      error(
        'CollectibleSource:Collision',
        `Collectible "${collectibleId}" has more than one source:`,
        collectibleSources,
      );
    }
  });

  return sources;
}

// Memoized on the content signals `collectibleSourceMapBuild` reads - only
// rebuilds when content itself changes, not on every gamestate tick, so the
// collision check above only ever logs once per actual content load.
export const collectibleSourceLookup = computed(() =>
  collectibleSourceMapBuild(),
);

export function getCollectibleSource(
  collectibleId: CollectibleId,
): CollectibleSource | undefined {
  return collectibleSourceLookup().get(collectibleId)?.[0];
}
