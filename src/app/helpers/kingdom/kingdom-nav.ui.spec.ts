import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  kingdomIconURL,
  kingdomIconURLs,
} from '@helpers/kingdom/kingdom-nav.ui';

describe('kingdomIconURL', () => {
  it('points at the kingdom asset folder', () => {
    expect(kingdomIconURL('storage')).toBe('asset/kingdom/storage.png');
  });
});

describe('kingdomIconURLs', () => {
  it('covers both feature and extra icons, once each', () => {
    const urls = kingdomIconURLs();

    expect(urls).toContain('asset/kingdom/storage.png');
    expect(urls).toContain('asset/kingdom/kingdom.png');
    expect(new Set(urls).size).toBe(urls.length);
  });

  // The loading screen preloads these, so a typo here would silently 404 instead of preloading.
  it('only lists icons that exist on disk', () => {
    const missing = kingdomIconURLs().filter(
      (url) => !existsSync(join('public', url)),
    );

    expect(missing).toEqual([]);
  });
});
