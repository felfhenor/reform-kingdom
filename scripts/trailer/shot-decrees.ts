import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

const START_NODE = 'Slimed Waystation';
const DECREE_HOLD_MS = 2_500;
const AUTO_MODE_ENABLED_HOLD_MS = 1_500;
const AUTO_MODE_MS = 10_000;
const AUTO_MODE_TICK_MULTIPLIER = 4;

export const decreesShot: TrailerShot = {
  name: 'decrees',
  description: 'The decree list, then the party carrying it out on its own.',
  options: { game: { mapZoom: 1.5 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, START_NODE);
    await t.evaluate((api) => api.setGamePlayView('decree'));
  },

  async action(t) {
    t.log('decree list');
    await t.wait(DECREE_HOLD_MS);

    await t.evaluate((api) => api.autoModeToggle(true));
    t.log('auto mode enabled');
    await t.wait(AUTO_MODE_ENABLED_HOLD_MS);

    await t.evaluate((api, tickMultiplier) => {
      api.setOption('debugTickMultiplier', tickMultiplier);
      api.setGamePlayView('world');
    }, AUTO_MODE_TICK_MULTIPLIER);
    t.log('auto mode');
    await t.wait(AUTO_MODE_MS);
  },
};
