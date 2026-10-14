import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';

export const TITLE_CRAWL_PARAGRAPHS: string[] = [
  'Once, there was a kingdom.',
  'The Founder formed it from nothing, setting a single stone at its heart. While the Founding Stone stood firm, the paths, towers, rivers and forests stayed within sight. Thus, the kingdom came to life.',
  'Then came the Sundering. The Founding Stone cracked, and slowly, the kingdom became fractured.',
  'The land began to forget itself. Paths became lost, towers vanished, rivers ran dry, and forests thinned. Those who left the kingdom never found their way back.',
  'Beyond the Felway lies Fel, the Demon of Forgetting. The Sundering was his doing, and his wish is for everything to be forgotten.',
  'Only the Duchy of Carrina remembered. There, beside the fractured Founding Stone, the Founder still rules: unseen, but not unheard.',
  "Now, the Founder has issued a decree. You have a party of heroes, the Founder's authority, and a great deal of paperwork. You must help find the lost, rebuild what is broken, and re-form the kingdom.",
];

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
