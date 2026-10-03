import { describe, expect, it } from 'vitest';

import { tutorialsState } from '@helpers/state-game';
import {
  isTutorialSeen,
  pruneInvalidTutorials,
  tutorialMarkSeen,
} from '@helpers/tutorial/tutorial-seen';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedGamestate } from '@/testing/gamestate';

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

describe('pruneInvalidTutorials', () => {
  it('keeps only tutorials the existence check accepts', () => {
    expect(
      pruneInvalidTutorials(
        { 'main-ui': { foundAt: 1000 }, removed: { foundAt: 2000 } },
        (tutorialId) => tutorialId === 'main-ui',
      ),
    ).toEqual({ 'main-ui': { foundAt: 1000 } });
  });
});
