import { isInElectron } from '@helpers/engine/electron';
import { afterEach, describe, expect, it } from 'vitest';

const originalUserAgent = navigator.userAgent;

function setUserAgent(value: string): void {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
}

describe('isInElectron', () => {
  afterEach(() => setUserAgent(originalUserAgent));

  it('detects electron from the user agent', () => {
    setUserAgent('Mozilla/5.0 electron/30.0.0');
    expect(isInElectron()).toBe(true);

    setUserAgent('Mozilla/5.0');
    expect(isInElectron()).toBe(false);
  });
});
