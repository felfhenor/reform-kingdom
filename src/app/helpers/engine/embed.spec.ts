import { isInIframe } from '@helpers/engine/embed';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('isInIframe', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is false when the game is the top window', () => {
    expect(isInIframe()).toBe(false);
  });

  it('is true when another page embeds the game', () => {
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);

    expect(isInIframe()).toBe(true);
  });
});
