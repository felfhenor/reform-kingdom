import { describe, expect, it } from 'vitest';

import { NODE_ANIMATION_CYCLE_MS } from '@helpers/config';
import { nodeAnimationFrameIndex } from '@helpers/pixi/pixi-node-animation';

describe('nodeAnimationFrameIndex', () => {
  it('steps through every frame once per cycle', () => {
    const quarter = NODE_ANIMATION_CYCLE_MS / 4;
    const indices = [0, 1, 2, 3, 4].map((step) =>
      nodeAnimationFrameIndex(step * quarter + 1, 4, 0),
    );
    expect(indices).toEqual([0, 1, 2, 3, 0]);
  });

  it('gives two-frame strips half a cycle per frame', () => {
    expect(nodeAnimationFrameIndex(NODE_ANIMATION_CYCLE_MS * 0.4, 2, 0)).toBe(
      0,
    );
    expect(nodeAnimationFrameIndex(NODE_ANIMATION_CYCLE_MS * 0.6, 2, 0)).toBe(
      1,
    );
  });

  it('starts a phased node partway through its loop', () => {
    expect(nodeAnimationFrameIndex(0, 4, 0.5)).toBe(2);
  });

  it('never runs past the last frame', () => {
    expect(
      nodeAnimationFrameIndex(NODE_ANIMATION_CYCLE_MS - 0.001, 4, 0.999),
    ).toBeLessThan(4);
  });
});
