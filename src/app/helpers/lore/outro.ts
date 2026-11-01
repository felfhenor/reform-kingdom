import { getEntry } from '@helpers/content/content';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import { metaState } from '@helpers/state-game';
import type { CollectibleContent } from '@interfaces';

// Only clearing Forgetter's Fane awards it, so owning it means Fel has fallen at least once.
const FINAL_COLLECTIBLE_NAME = 'Memory of the Forgetter';

export function isOutroCrawlPending(): boolean {
  if (metaState().outroCrawlSeen) return false;

  const finalCollectible = getEntry<CollectibleContent>(FINAL_COLLECTIBLE_NAME);
  return !!finalCollectible && isCollectibleDiscovered(finalCollectible.id);
}

export function isVictoryPopupPending(): boolean {
  const meta = metaState();
  return meta.outroCrawlSeen && !meta.victoryPopupSeen;
}

// The world, tutorials and region intros all hold while one of these covers the game.
export function isStoryScreenPending(): boolean {
  return (
    isTitleCrawlPending() || isOutroCrawlPending() || isVictoryPopupPending()
  );
}
