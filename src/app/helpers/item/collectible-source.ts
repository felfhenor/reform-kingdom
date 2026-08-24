import { computed } from '@angular/core';
import { getEntriesByType } from '@helpers/content';
import { error } from '@helpers/engine/logging';
import type {
  CaravanTraderContent,
  CollectibleId,
  CollectibleSource,
  EncounterContent,
  EncounterRandomContent,
  RecipeContent,
} from '@interfaces';

// Builds the collectible -> source lookup from static content only, so it reflects current content even for old saves. A collectible with more than one source is a content bug and gets logged.
export function collectibleSourceMapBuild(): Map<
  CollectibleId,
  CollectibleSource[]
> {
  const sources = new Map<CollectibleId, CollectibleSource[]>();

  const addSource = (
    collectibleId: CollectibleId,
    source: CollectibleSource,
  ) => {
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

// Memoized on content signals - rebuilds only on content change, not every tick.
export const collectibleSourceLookup = computed(() =>
  collectibleSourceMapBuild(),
);

export function getCollectibleSource(
  collectibleId: CollectibleId,
): CollectibleSource | undefined {
  return collectibleSourceLookup().get(collectibleId)?.[0];
}
