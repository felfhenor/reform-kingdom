import { describe, expect, it } from 'vitest';

import {
  ensureShrine,
  ensureShrineLevel,
} from '@helpers/content/ensure-shrine';
import {
  worldNodeShrineCurrentTier,
  worldNodeShrineLevel,
} from '@helpers/world-node/world-node-shrine';
import type { GameState, GlobalEffectId } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

const node = "Founder's Shrine";
const shrine = ensureShrine({
  name: node,
  levels: ['I', 'II', 'III'].map((tier) =>
    ensureShrineLevel({ globalEffectId: `Wisdom ${tier}` as GlobalEffectId }),
  ),
});

function atLevel(level?: number): void {
  seedGamestate((state) => {
    if (level !== undefined) state.shrines[node] = { level };
  });
}

describe('worldNodeShrineLevel', () => {
  it('reads the stored level, defaulting to 0 even before the shrines slice exists', () => {
    atLevel(2);
    expect(worldNodeShrineLevel(node)).toBe(2);

    atLevel();
    expect(worldNodeShrineLevel(node)).toBe(0);

    seedGamestate((state) => {
      delete (state as Partial<GameState>).shrines;
    });
    expect(worldNodeShrineLevel(node)).toBe(0);
  });
});

describe('worldNodeShrineCurrentTier', () => {
  it('grants nothing until the first investment, then the tier matching the level', () => {
    const tierAt = (level?: number) => {
      atLevel(level);
      return worldNodeShrineCurrentTier(shrine, node)?.globalEffectId;
    };

    expect(tierAt()).toBeUndefined();
    expect(tierAt(1)).toBe('Wisdom I');
    expect(tierAt(3)).toBe('Wisdom III');
  });
});
