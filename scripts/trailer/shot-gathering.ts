import { shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

// A desert oasis, so this reads differently from the Carrina bustle shot.
const GATHER_NODE = 'Oasis Wellspring';
const TICK_MULTIPLIER = 3;
const GATHER_MS = 8_000;

export const gatheringShot: TrailerShot = {
  name: 'gathering',
  description: `The party gathers at ${GATHER_NODE}.`,
  options: { game: { mapZoom: 2 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, GATHER_NODE);
    await t.evaluate(
      (api, multiplier) => api.setOption('debugTickMultiplier', multiplier),
      TICK_MULTIPLIER,
    );
  },

  async action(t) {
    const started = await t.evaluate(
      (api, nodeName) => api.gatheringStart(nodeName),
      GATHER_NODE,
    );
    if (!started) throw new Error(`The party can't gather at ${GATHER_NODE}.`);
    t.log('gathering');
    await t.wait(GATHER_MS);
  },
};
