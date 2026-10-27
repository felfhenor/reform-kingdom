import { cssColorCacheClear, cssColorVar } from '@helpers/engine/css-color';
import { afterEach, describe, expect, it } from 'vitest';

describe('cssColorVar', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--test-color');
    cssColorCacheClear();
  });

  it('falls back to white without caching an unset variable', () => {
    expect(cssColorVar('--test-color')).toBe('#ffffff');
    document.documentElement.style.setProperty('--test-color', '#123456');
    expect(cssColorVar('--test-color')).toBe('#123456');
  });

  it('keeps the cached value until the cache is cleared', () => {
    document.documentElement.style.setProperty('--test-color', '#123456');
    expect(cssColorVar('--test-color')).toBe('#123456');

    document.documentElement.style.setProperty('--test-color', '#abcdef');
    expect(cssColorVar('--test-color')).toBe('#123456');

    cssColorCacheClear();
    expect(cssColorVar('--test-color')).toBe('#abcdef');
  });
});
