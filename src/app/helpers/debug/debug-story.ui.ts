import { updateGamestate } from '@helpers/state-game';

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
