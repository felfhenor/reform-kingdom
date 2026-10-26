import { shotClick, shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

const START_NODE = 'Slimed Waystation';
const CRAFT_COUNT = 3;
// Enough of every material that several different recipes are craftable.
const MATERIAL_GRANT = 50;
const BETWEEN_CRAFTS_MS = 900;
// Fast enough for the queue to visibly tick down and finish crafts on camera.
const TICK_MULTIPLIER = 10;
const QUEUE_HOLD_MS = 6_000;

export const craftingShot: TrailerShot = {
  name: 'crafting',
  description: 'Recipes fly into the blacksmithing queue and get crafted.',
  options: { hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);
    await t.evaluate((api, quantity) => {
      api.debugGiveAllItems(quantity);
      api.setGamePlayView('kingdom');
      api.kingdomSubviewShow('tradeskill-blacksmithing');
    }, MATERIAL_GRANT);
    await t.page
      .getByRole('button', { name: 'Craft', exact: true })
      .first()
      .waitFor();
  },

  async action(t) {
    const craftButtons = t.page.locator(
      'app-panel-play-kingdom-tradeskill button.btn-primary:not([disabled])',
      { hasText: 'Craft' },
    );
    for (let i = 0; i < CRAFT_COUNT; i++) {
      // A different row each time, so each craft flies into its own queue slot.
      if ((await craftButtons.count()) <= i) break;
      await shotClick(t, craftButtons.nth(i));
      t.log(`craft ${i + 1}`);
      await t.wait(BETWEEN_CRAFTS_MS);
    }

    await t.evaluate(
      (api, multiplier) => api.setOption('debugTickMultiplier', multiplier),
      TICK_MULTIPLIER,
    );
    await t.wait(QUEUE_HOLD_MS);
  },
};
