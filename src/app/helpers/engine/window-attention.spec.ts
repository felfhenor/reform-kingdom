import { windowAttentionRaised } from '@helpers/engine/window-attention';
import { describe, expect, it } from 'vitest';

describe('windowAttentionRaised', () => {
  it('raises when a flag turns on', () => {
    expect(windowAttentionRaised([false, false], [false, true])).toBe(true);
  });

  it('stays quiet for a flag that was already on', () => {
    expect(windowAttentionRaised([true, false], [true, false])).toBe(false);
  });

  it('stays quiet when a flag turns off', () => {
    expect(windowAttentionRaised([true, true], [false, true])).toBe(false);
  });

  it('raises again after a flag turns off and back on', () => {
    const off = [false];
    expect(windowAttentionRaised([true], off)).toBe(false);
    expect(windowAttentionRaised(off, [true])).toBe(true);
  });
});
