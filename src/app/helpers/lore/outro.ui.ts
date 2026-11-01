import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { saveGameState, updateGamestate } from '@helpers/state-game';

export const OUTRO_CRAWL_PARAGRAPHS: string[] = [
  'Fel, the Forgetter, has fallen.',
  'Without him, his demons scatter back toward the Pale. The Astral Observatory collapses and the land he forgot begins, slowly, to remember itself.',
  'The memories he devoured will slowly find their way home. The sands of Larsia recall the soil beneath them. The Erden trees recall how to grow. The mire, the mountains and the frozen summit each recall their own shape.',
  'The Founding Stone is still cracked. It may never recover from that. But a kingdom was never only a stone - it is roads that lead somewhere, towns that trade, and travelers who explore. The damage may never be fully undone, but together with the Founder, you can mend the scars.',
  'In Carrina, the Founder reads your final report and issues one more decree: the work will continue. You both know the work will never be done.',
  'There are still the lost to find, roads to mend, and, as ever, a great deal of paperwork.',
  'Once, there was a kingdom - expansive and diverse. Thanks to you, there still is.',
];

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
