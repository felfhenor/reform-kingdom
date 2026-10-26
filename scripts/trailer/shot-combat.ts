import { shotFightToEnd, shotWorldPrepare } from './shot-common';
import type { TrailerShot } from './types';

// Close to the save's party level, so the fight runs long enough to read.
const ENCOUNTER_NODE = 'Diurtar';
const AFTERMATH_HOLD_MS = 1_500;

export const combatShot: TrailerShot = {
  name: 'combat',
  description: `The party fights its way into ${ENCOUNTER_NODE}.`,
  options: { game: { mapZoom: 1.5 }, hideToasts: true },

  async setup(t) {
    await shotWorldPrepare(t, ENCOUNTER_NODE);
  },

  async action(t) {
    await shotFightToEnd(t, ENCOUNTER_NODE);
    await t.wait(AFTERMATH_HOLD_MS);
  },
};
