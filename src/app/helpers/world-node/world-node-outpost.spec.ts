import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    outpostsState: () => gamestate().outposts,
  };
});

vi.mock('@helpers/world-node/world-nodes', () => ({
  isWorldNodeVisible: vi.fn(() => true),
  worldNodesOfType: vi.fn(() => []),
}));

import { gamestate } from '@helpers/state-game';
import {
  isOutpostBuilt,
  isOutpostTeleportListed,
  isOutpostTeleportUnlocked,
  outpostDeathPenaltyMultiplier,
  outpostsWithTeleportUnlocked,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import {
  isWorldNodeVisible,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { GameState, WorldNodeEntry } from '@interfaces';

function outpostEntry(nodeName: string): WorldNodeEntry {
  return { nodeName, mapName: nodeName, x: 0, y: 0 } as WorldNodeEntry;
}

function mockOutpostLevels(levels: Record<string, number>): void {
  vi.mocked(gamestate).mockReturnValue({
    outposts: Object.fromEntries(
      Object.entries(levels).map(([nodeName, level]) => [nodeName, { level }]),
    ),
  } as unknown as GameState);
}

function mockOutpostLevel(level: number | undefined): void {
  vi.mocked(gamestate).mockReturnValue({
    outposts: level === undefined ? {} : { 'Carrina Outpost': { level } },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isWorldNodeVisible).mockReturnValue(true);
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

  it.each([5, 10])(
    'stops shrinking past the death penalty cap (level %s)',
    (level) => {
      mockOutpostLevel(level);

      expect(outpostDeathPenaltyMultiplier('Carrina Outpost')).toBe(0.25);
    },
  );

  it('is 1 for a node that is not an outpost', () => {
    mockOutpostLevel(4);

    expect(outpostDeathPenaltyMultiplier('Duchy of Carrina')).toBe(1);
  });
});

describe('isOutpostTeleportUnlocked', () => {
  it.each([
    [undefined, false],
    [4, false],
    [5, true],
  ])('at level %s is %s', (level, unlocked) => {
    mockOutpostLevel(level);

    expect(isOutpostTeleportUnlocked('Carrina Outpost')).toBe(unlocked);
  });
});

describe('isOutpostTeleportListed', () => {
  it('lists a visible, built outpost', () => {
    mockOutpostLevel(1);

    expect(isOutpostTeleportListed(outpostEntry('Carrina Outpost'))).toBe(true);
  });

  it('hides an unbuilt outpost', () => {
    mockOutpostLevel(0);

    expect(isOutpostTeleportListed(outpostEntry('Carrina Outpost'))).toBe(
      false,
    );
  });

  it('hides an outpost that is not visible', () => {
    mockOutpostLevel(1);
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

    expect(isOutpostTeleportListed(outpostEntry('Carrina Outpost'))).toBe(
      false,
    );
  });
});

describe('outpostsWithTeleportUnlocked', () => {
  it('keeps only visible outposts at +5', () => {
    vi.mocked(worldNodesOfType).mockReturnValue([
      outpostEntry('Carrina Outpost'),
      outpostEntry('Larsian Outpost'),
      outpostEntry('Mire Outpost'),
    ]);
    mockOutpostLevels({ 'Carrina Outpost': 5, 'Larsian Outpost': 4 });

    expect(
      outpostsWithTeleportUnlocked().map((entry) => entry.nodeName),
    ).toEqual(['Carrina Outpost']);
  });
});
