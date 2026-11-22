import { computed } from '@angular/core';
import { getEntriesByType } from '@helpers/content/content';
import { error } from '@helpers/engine/logging';
import { baseContentSources } from '@helpers/item/content-sources';
import type {
  CollectibleContent,
  CollectibleId,
  CollectibleSource,
} from '@interfaces';

// Static content only, so it reflects current content even for old saves. A collectible with more than one source is a content bug and gets logged.
export function collectibleSourceMapBuild(): Map<
  CollectibleId,
  CollectibleSource[]
> {
  const sources = new Map(
    getEntriesByType<CollectibleContent>('collectible').flatMap(
      (collectible) => {
        const found = baseContentSources({ collectibleId: collectible.id });
        return found.length > 0 ? [[collectible.id, found] as const] : [];
      },
    ),
  );

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

export const collectibleSourceLookup = computed(() =>
  collectibleSourceMapBuild(),
);

export function getCollectibleSource(
  collectibleId: CollectibleId,
): CollectibleSource | undefined {
  return collectibleSourceLookup().get(collectibleId)?.[0];
}
