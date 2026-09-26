import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('rxjs', async () => await vi.importActual('rxjs'));

vi.mock('@helpers/engine/page-visibility', () => ({
  isPageVisible: vi.fn(),
}));

import {
  heroLevelUpVfx$,
  heroLevelUpVfxEmit,
} from '@helpers/engine/hero-level-up-vfx';
import { isPageVisible } from '@helpers/engine/page-visibility';

describe('heroLevelUpVfxEmit', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('emits the character id to subscribers while the page is visible', () => {
    vi.mocked(isPageVisible).mockReturnValue(true);
    const received: string[] = [];
    const subscription = heroLevelUpVfx$.subscribe((id) => received.push(id));

    heroLevelUpVfxEmit('hero-1');
    subscription.unsubscribe();

    expect(received).toEqual(['hero-1']);
  });

  it('drops the event while the page is hidden', () => {
    vi.mocked(isPageVisible).mockReturnValue(false);
    const received: string[] = [];
    const subscription = heroLevelUpVfx$.subscribe((id) => received.push(id));

    heroLevelUpVfxEmit('hero-1');
    subscription.unsubscribe();

    expect(received).toEqual([]);
  });
});
