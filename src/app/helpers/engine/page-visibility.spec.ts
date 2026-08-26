import { isPageVisible } from '@helpers/engine/page-visibility';
import { afterEach, describe, expect, it } from 'vitest';

describe('isPageVisible', () => {
  afterEach(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  it('returns true when the document is not hidden', () => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });

    expect(isPageVisible()).toBe(true);
  });

  it('returns false when the document is hidden', () => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });

    expect(isPageVisible()).toBe(false);
  });
});
