import { describe, expect, it } from 'vitest';

import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import type { GameState } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

const mines = 'Carrina Copper Mines';

describe('worldNodeLevel', () => {
  it('reads the stored level, defaulting to 0 even before the levels slice exists', () => {
    seedGamestate((state) => {
      state.gatherNodeLevels[mines] = { level: 3 };
    });
    expect(worldNodeLevel(mines)).toBe(3);

    seedGamestate();
    expect(worldNodeLevel(mines)).toBe(0);

    seedGamestate((state) => {
      delete (state as Partial<GameState>).gatherNodeLevels;
    });
    expect(worldNodeLevel(mines)).toBe(0);
  });
});
