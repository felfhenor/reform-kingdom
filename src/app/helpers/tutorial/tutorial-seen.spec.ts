import { describe, expect, it } from 'vitest';

import { tutorialsState } from '@helpers/state-game';
import {
  isTutorialSeen,
  tutorialMarkSeen,
  tutorialRearmProcessTick,
} from '@helpers/tutorial/tutorial-seen';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { inTick, seedGamestate } from '@/testing/gamestate';

describe('tutorialMarkSeen', () => {
  it('is seen as soon as the call resolves, outside a tick too', async () => {
    seedGamestate();
    const events = captureAnalyticsEvents();
    expect(isTutorialSeen('main-ui')).toBe(false);

    await tutorialMarkSeen('main-ui');

    expect(isTutorialSeen('main-ui')).toBe(true);
    expect(events).toEqual(['Tutorial:Seen:main-ui']);
  });

  it('leaves an already-seen tutorial alone, unreported', async () => {
    seedGamestate((state) => {
      state.tutorials['main-ui'] = { foundAt: 1000 };
    });
    const events = captureAnalyticsEvents();

    await tutorialMarkSeen('main-ui');

    expect(tutorialsState()['main-ui']).toEqual({ foundAt: 1000 });
    expect(events).toEqual([]);
  });
});

describe('tutorialRearmProcessTick', () => {
  it('un-sees a repeatable tutorial once its trigger stops holding', () => {
    seedGamestate((state) => {
      state.tutorials['losing-streak'] = { foundAt: 1000 };
      state.tutorials['main-ui'] = { foundAt: 1000 };
    });

    inTick(() => tutorialRearmProcessTick());

    expect(isTutorialSeen('losing-streak')).toBe(false);
    expect(isTutorialSeen('main-ui')).toBe(true);
  });

  it('keeps it seen while the trigger still holds', () => {
    seedGamestate((state) => {
      state.tutorials['losing-streak'] = { foundAt: 1000 };
      state.world.autoMode.nodeFailureCounts = { A: 3 };
    });

    inTick(() => tutorialRearmProcessTick());

    expect(isTutorialSeen('losing-streak')).toBe(true);
  });
});
