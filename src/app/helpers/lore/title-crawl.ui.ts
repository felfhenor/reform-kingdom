import { t } from '@helpers/i18n/i18n';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';

const TITLE_CRAWL_PARAGRAPHS_KEYS = [
  'titleCrawl.paragraph1',
  'titleCrawl.paragraph2',
  'titleCrawl.paragraph3',
  'titleCrawl.paragraph4',
  'titleCrawl.paragraph5',
  'titleCrawl.paragraph6',
  'titleCrawl.paragraph7',
] as const;

export function titleCrawlParagraphs(): string[] {
  return TITLE_CRAWL_PARAGRAPHS_KEYS.map((key) => t(key));
}

export function titleCrawlQueue(): Promise<void> {
  return updateGamestate((state) => {
    state.meta.titleCrawlPending = true;
    return state;
  });
}

export async function titleCrawlFinish(wasSkipped: boolean): Promise<void> {
  await updateGamestate((state) => {
    state.meta.titleCrawlPending = false;
    return state;
  });

  analyticsSendDesignEvent(
    wasSkipped ? 'Lore:TitleCrawl:Skipped' : 'Lore:TitleCrawl:Watched',
  );
}
