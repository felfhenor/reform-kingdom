import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    outpostsState: () => gamestate().outposts,
  };
});

import { gamestate } from '@helpers/state-game';
import {
  isOutpostBuilt,
  outpostDeathPenaltyMultiplier,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import type { GameState } from '@interfaces';

function mockOutpostLevel(level: number | undefined): void {
  vi.mocked(gamestate).mockReturnValue({
    outposts: level === undefined ? {} : { 'Carrina Outpost': { level } },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('worldNodeOutpostLevel', () => {
  it('defaults to 0 when the node has no stored level', () => {
    mockOutpostLevel(undefined);

    expect(worldNodeOutpostLevel('Carrina Outpost')).toBe(0);
  });

  it('defaults to 0 when the outposts slice itself is missing (pre-outpost save)', () => {
    vi.mocked(gamestate).mockReturnValue({} as unknown as GameState);

    expect(worldNodeOutpostLevel('Carrina Outpost')).toBe(0);
  });

  it('returns the stored level', () => {
    mockOutpostLevel(3);

    expect(worldNodeOutpostLevel('Carrina Outpost')).toBe(3);
  });
});

describe('isOutpostBuilt', () => {
  it('is false at level 0', () => {
    mockOutpostLevel(0);

    expect(isOutpostBuilt('Carrina Outpost')).toBe(false);
  });

  it('is true from level 1', () => {
    mockOutpostLevel(1);

    expect(isOutpostBuilt('Carrina Outpost')).toBe(true);
  });
});

describe('outpostDeathPenaltyMultiplier', () => {
  it.each([
    [undefined, 1],
    [0, 1],
    [1, 1],
    [2, 0.75],
    [3, 0.5],
    [4, 0.25],
  ])('at level %s is %s', (level, multiplier) => {
    mockOutpostLevel(level);

    expect(outpostDeathPenaltyMultiplier('Carrina Outpost')).toBe(multiplier);
  });

  it('never goes negative past the max level', () => {
    mockOutpostLevel(10);

    expect(outpostDeathPenaltyMultiplier('Carrina Outpost')).toBe(0);
  });

  it('is 1 for a node that is not an outpost', () => {
    mockOutpostLevel(4);

    expect(outpostDeathPenaltyMultiplier('Duchy of Carrina')).toBe(1);
  });
});
