import {
  finalCollectibleId,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import { metaState } from '@helpers/state-game';

export function isFelDefeated(): boolean {
  const finalId = finalCollectibleId();
  return !!finalId && isCollectibleDiscovered(finalId);
}

export function isOutroCrawlPending(): boolean {
  return !metaState().outroCrawlSeen && isFelDefeated();
}

export function isVictoryPopupPending(): boolean {
  const meta = metaState();
  return meta.outroCrawlSeen && !meta.victoryPopupSeen;
}

export function isRunLost(): boolean {
  return !!metaState().runLost;
}

// The world, tutorials and region intros all hold while one of these covers the game.
export function isStoryScreenPending(): boolean {
  return (
    isRunLost() ||
    isTitleCrawlPending() ||
    isOutroCrawlPending() ||
    isVictoryPopupPending()
  );
}
