import type * as AnalyticsHelper from '@helpers/engine/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  isTutorialSeen,
  pruneInvalidTutorials,
  tutorialMarkSeen,
  tutorialUnmarkSeen,
} from '@helpers/tutorial/tutorial-seen';
import type { GameState, GameStateTutorials } from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('isTutorialSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true once the tutorial has a foundAt timestamp', () => {
    vi.mocked(gamestate).mockReturnValue({
      tutorials: { 'main-ui': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(isTutorialSeen('main-ui')).toBe(true);
  });

  it('is false for a tutorial never seen', () => {
    vi.mocked(gamestate).mockReturnValue({
      tutorials: {},
    } as unknown as GameState);

    expect(isTutorialSeen('main-ui')).toBe(false);
  });
});

describe('tutorialMarkSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a foundAt timestamp for a newly-seen tutorial', async () => {
    vi.mocked(gamestate).mockReturnValue({
      tutorials: {},
    } as unknown as GameState);

    await tutorialMarkSeen('main-ui');

    const result = applyLastUpdate({
      tutorials: {},
    } as unknown as GameState);

    expect(result.tutorials['main-ui'].foundAt).toEqual(expect.any(Number));
  });

  it('sends an analytics event only the first time a tutorial is marked seen', async () => {
    vi.mocked(gamestate).mockReturnValue({
      tutorials: {},
    } as unknown as GameState);

    await tutorialMarkSeen('main-ui');

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Tutorial:Seen:main-ui',
    );
  });

  it('does nothing on repeat marking - no state update, no analytics event', async () => {
    vi.mocked(gamestate).mockReturnValue({
      tutorials: { 'main-ui': { foundAt: 1000 } },
    } as unknown as GameState);

    await tutorialMarkSeen('main-ui');

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(analyticsSendDesignEvent).not.toHaveBeenCalled();
  });
});

describe('tutorialUnmarkSeen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the seen entry', () => {
    tutorialUnmarkSeen('main-ui');

    const result = applyLastUpdate({
      tutorials: { 'main-ui': { foundAt: 1000 } },
    } as unknown as GameState);

    expect(result.tutorials['main-ui']).toBeUndefined();
  });
});

describe('pruneInvalidTutorials', () => {
  it('keeps only entries the existence check accepts', () => {
    const tutorials: GameStateTutorials = {
      'main-ui': { foundAt: 1000 },
      'removed-tutorial': { foundAt: 2000 },
    };

    const result = pruneInvalidTutorials(
      tutorials,
      (tutorialId) => tutorialId === 'main-ui',
    );

    expect(result).toEqual({ 'main-ui': { foundAt: 1000 } });
  });
});
