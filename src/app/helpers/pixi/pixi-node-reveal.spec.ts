import { NODE_REVEAL_LIFETIME_MS, NODE_REVEAL_POP_MS } from '@helpers/config';
import { nodeRevealState } from '@helpers/pixi/pixi-node-reveal';
import { describe, expect, it } from 'vitest';

describe('nodeRevealState', () => {
  it('starts at zero scale with a full-opacity ring', () => {
    const start = nodeRevealState(0);
    expect(start?.scale).toBeCloseTo(0);
    expect(start?.ringScale).toBe(0);
    expect(start?.ringAlpha).toBe(1);
  });

  it('overshoots full size during the pop', () => {
    const peak = Math.max(
      ...[0.6, 0.7, 0.8].map(
        (f) => nodeRevealState(NODE_REVEAL_POP_MS * f)?.scale ?? 0,
      ),
    );
    expect(peak).toBeGreaterThan(1);
  });

  it('settles at full size once the pop ends', () => {
    expect(nodeRevealState(NODE_REVEAL_POP_MS)?.scale).toBeCloseTo(1);
    expect(nodeRevealState(NODE_REVEAL_LIFETIME_MS - 1)?.scale).toBeCloseTo(1);
  });

  it('expands and fades the ring over the lifetime', () => {
    const half = nodeRevealState(NODE_REVEAL_LIFETIME_MS / 2);
    expect(half?.ringScale).toBeCloseTo(0.5);
    expect(half?.ringAlpha).toBeCloseTo(0.5);
  });

  it('returns undefined once the lifetime has elapsed', () => {
    expect(nodeRevealState(NODE_REVEAL_LIFETIME_MS)).toBeUndefined();
  });
});
