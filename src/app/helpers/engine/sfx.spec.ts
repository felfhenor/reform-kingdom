import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/page-visibility', () => ({
  isPageVisible: vi.fn(),
}));

import { GAME_SFX_MIN_INTERVAL_MS } from '@helpers/config';
import { isPageVisible } from '@helpers/engine/page-visibility';
import { playGameSFX, sfx$ } from '@helpers/engine/sfx';
import type { SFX } from '@interfaces';

function capturePlayed(): { played: SFX[]; stop: () => void } {
  const played: SFX[] = [];
  const subscription = sfx$.subscribe(({ sfx }) => played.push(sfx));
  return { played, stop: () => subscription.unsubscribe() };
}

describe('playGameSFX', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('drops the sound while the page is hidden', () => {
    vi.mocked(isPageVisible).mockReturnValue(false);
    const { played, stop } = capturePlayed();

    playGameSFX('victory');
    stop();

    expect(played).toEqual([]);
  });

  it('plays a sound once per interval, throttling each sound separately', () => {
    vi.mocked(isPageVisible).mockReturnValue(true);
    const { played, stop } = capturePlayed();

    playGameSFX('item-get-major');
    playGameSFX('item-get-major');
    playGameSFX('victory');
    vi.advanceTimersByTime(GAME_SFX_MIN_INTERVAL_MS);
    playGameSFX('item-get-major');
    stop();

    expect(played).toEqual(['item-get-major', 'victory', 'item-get-major']);
  });
});
