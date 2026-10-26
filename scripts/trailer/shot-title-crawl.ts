import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

// Beside the Duchy of Carrina, so the crawl fades out onto the Founder's seat.
const START_NODE = 'Field Ruins';
// 7 paragraphs at 7s each plus the fade, with headroom.
const CRAWL_MAX_MS = 70_000;
const MAP_HOLD_MS = 2_000;

export const titleCrawlShot: TrailerShot = {
  name: 'title-crawl',
  description: 'The opening crawl scrolls, then fades into Carrina.',
  options: {
    game: { mapZoom: 1.5 },
    hideToasts: true,
    hideSelectors: ['app-screen-title-crawl button'],
    // Sized for reading on a phone in a trailer rather than at a desk in-game.
    css: `app-screen-title-crawl .crawl-text {
      width: 64rem !important;
      font-size: 2.5rem !important;
      gap: 3.5rem !important;
    }`,
  },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);
  },

  async action(t) {
    await t.evaluate((api) => api.titleCrawlQueue());
    t.log('crawl start');

    await t.until((api) => !api.isTitleCrawlPending(), undefined, CRAWL_MAX_MS);
    t.log('crawl end');
    await t.wait(MAP_HOLD_MS);
  },
};
