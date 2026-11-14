import { getEntriesByType } from '@helpers/content/content';
import { updateGamestate } from '@helpers/state-game';
import type { RegionContent } from '@interfaces';

export function debugResetIntroCrawl(): void {
  updateGamestate((state) => {
    state.meta.titleCrawlPending = true;
    return state;
  });
}

// Only replays once Memory of the Forgetter is owned.
export function debugResetOutroCrawl(): void {
  updateGamestate((state) => {
    state.meta.outroCrawlSeen = false;
    return state;
  });
}

// Only reappears once the outro crawl has been seen.
export function debugResetVictoryCard(): void {
  updateGamestate((state) => {
    state.meta.victoryPopupSeen = false;
    return state;
  });
}

// Shows or clears the "run lost" card without needing a real wipe.
export function debugSetRunLost(lost = true): void {
  updateGamestate((state) => {
    state.meta.runLost = lost;
    return state;
  });
}

// Seals every region, so it also unlocks anything gated on those seals.
export function debugShowDemoEnd(): void {
  updateGamestate((state) => {
    getEntriesByType<RegionContent>('region').forEach((region) => {
      state.runStats.seals[region.id] ??= state.clock.numTicks;
    });
    state.meta.demoEndSeen = false;
    return state;
  });
}
