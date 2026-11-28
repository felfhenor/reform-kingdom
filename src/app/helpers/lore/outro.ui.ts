import { t } from '@helpers/i18n/i18n';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { saveGameState, updateGamestate } from '@helpers/state-game';

const OUTRO_CRAWL_PARAGRAPHS_KEYS = [
  'outroCrawl.paragraph1',
  'outroCrawl.paragraph2',
  'outroCrawl.paragraph3',
  'outroCrawl.paragraph4',
  'outroCrawl.paragraph5',
  'outroCrawl.paragraph6',
  'outroCrawl.paragraph7',
] as const;

export function outroCrawlParagraphs(): string[] {
  return OUTRO_CRAWL_PARAGRAPHS_KEYS.map((key) => t(key));
}

export async function outroCrawlFinish(wasSkipped: boolean): Promise<void> {
  await updateGamestate((state) => {
    state.meta.outroCrawlSeen = true;
    return state;
  });

  // The gameloop's autosave is held through the crawl, so Fel's defeat isn't on disk yet.
  void saveGameState();

  analyticsSendDesignEvent(
    wasSkipped ? 'Lore:OutroCrawl:Skipped' : 'Lore:OutroCrawl:Watched',
  );
}

export async function victoryPopupDismiss(): Promise<void> {
  await updateGamestate((state) => {
    state.meta.victoryPopupSeen = true;
    return state;
  });

  analyticsSendDesignEvent('Lore:VictoryPopup:Dismissed');
}
