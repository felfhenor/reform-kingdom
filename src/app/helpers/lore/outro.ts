import {
  finalCollectibleId,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { isTitleCrawlPending } from '@helpers/lore/title-crawl';
import { globalEffectSumsState, metaState } from '@helpers/state-game';

export function isFelDefeated(): boolean {
  const finalId = finalCollectibleId();
  return !!finalId && isCollectibleDiscovered(finalId);
}

export function isOutroCrawlPending(): boolean {
  return (
    !metaState().outroCrawlSeen &&
    !globalEffectSumsState().skipStoryCrawls &&
    isFelDefeated()
  );
}

export function isVictoryPopupPending(): boolean {
  const meta = metaState();
  if (meta.victoryPopupSeen) return false;
  return (
    meta.outroCrawlSeen ||
    (globalEffectSumsState().skipStoryCrawls && isFelDefeated())
  );
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
