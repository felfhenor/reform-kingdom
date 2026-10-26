import type { TrailerShot } from './types';

const CARD_HOLD_MS = 6_000;

export const endCardShot: TrailerShot = {
  name: 'end-card',
  description: 'The title over the splash art, with the menu hidden.',
  options: {
    // Everything on the title screen except the title itself.
    hideSelectors: [
      'app-home .homescreen > :not(:first-child)',
      'app-home .fixed.bottom-0',
      'app-button-update',
    ],
  },

  async setup(t) {
    await t.navigate('/');
  },

  async action(t) {
    t.log('end card');
    await t.wait(CARD_HOLD_MS);
  },
};
