import { describe, expect, it } from 'vitest';

import {
  NODE_SPARKLE_ALPHA_MAX,
  NODE_SPARKLE_MOTE_COUNT,
  NODE_SPARKLE_PERIOD_MS,
} from '@helpers/config';
import {
  nodeSparkleMotePhases,
  nodeSparkleMoteState,
  nodeSparkleMoteStill,
} from '@helpers/pixi/pixi-node-sparkle';

describe('nodeSparkleMotePhases', () => {
  it('spaces one node’s motes evenly around the cycle', () => {
    const phases = nodeSparkleMotePhases(7);
    expect(phases).toHaveLength(NODE_SPARKLE_MOTE_COUNT);

    const sorted = [...phases].sort((a, b) => a - b);
    sorted
      .slice(1)
      .forEach((phase, index) =>
        expect(phase - sorted[index]).toBeCloseTo(1 / NODE_SPARKLE_MOTE_COUNT),
      );
  });

  it('offsets different nodes differently', () => {
    expect(nodeSparkleMotePhases(1)[0]).not.toBeCloseTo(
      nodeSparkleMotePhases(2)[0],
    );
  });
});

describe('nodeSparkleMoteState', () => {
  const at = (fraction: number) =>
    nodeSparkleMoteState(NODE_SPARKLE_PERIOD_MS * fraction, 0);

  it('fades in from nothing, peaks mid-cycle, and fades back out', () => {
    expect(at(0).alpha).toBeCloseTo(0);
    expect(at(0.5).alpha).toBeCloseTo(NODE_SPARKLE_ALPHA_MAX);
    expect(at(0.999).alpha).toBeLessThan(0.01);
  });

  it('drifts upward without moving sideways within a cycle', () => {
    expect(at(0.8).y).toBeGreaterThan(at(0.2).y);
    expect(at(0.8).x).toBe(at(0.2).x);
  });

  it('stays inside the tile', () => {
    [0, 0.25, 0.5, 0.75, 1.5, 2.25, 9.9].forEach((fraction) => {
      const state = at(fraction);
      expect(state.x).toBeGreaterThan(0);
      expect(state.x).toBeLessThan(1);
      expect(state.y).toBeGreaterThan(0);
      expect(state.y).toBeLessThan(1);
    });
  });
});

describe('nodeSparkleMoteStill', () => {
  it('holds a visible, unmoving glint', () => {
    expect(nodeSparkleMoteStill(0.3)).toEqual(nodeSparkleMoteStill(0.3));
    expect(nodeSparkleMoteStill(0.3).alpha).toBeCloseTo(NODE_SPARKLE_ALPHA_MAX);
  });
});
