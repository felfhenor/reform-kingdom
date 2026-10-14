import { metaState } from '@helpers/state-game';

export function isTitleCrawlPending(): boolean {
  return metaState().titleCrawlPending;
}
