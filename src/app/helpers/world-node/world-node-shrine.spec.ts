import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

import { gamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  isPartyAtShrine,
  pruneInvalidShrineLevels,
  worldNodeShrineCurrentTier,
  worldNodeShrineIsMaxLevel,
  worldNodeShrineLevel,
  worldNodeShrineLevelUpCost,
  worldNodeShrineMaxAchievableLevel,
} from '@helpers/world-node/world-node-shrine';
import type {
  GameState,
  GlobalEffectId,
  ItemId,
  ShrineContent,
  ShrineLevel,
  WorldNodeEntry,
} from '@interfaces';

function buildShrine(overrides: Partial<ShrineContent> = {}): ShrineContent {
  return {
    levels: [
      {
        costs: [{ itemId: 'Gold Coin' as ItemId, required: 500 }],
        globalEffectId: 'Wisdom of the Founder I' as GlobalEffectId,
        globalEffectDuration: 1800,
      },
      {
        costs: [{ itemId: 'Gold Coin' as ItemId, required: 10000 }],
        globalEffectId: 'Wisdom of the Founder II' as GlobalEffectId,
        globalEffectDuration: 3600,
      },
      {
        costs: [{ itemId: 'Gold Coin' as ItemId, required: 25000 }],
        globalEffectId: 'Wisdom of the Founder III' as GlobalEffectId,
        globalEffectDuration: 7200,
      },
    ] as ShrineLevel[],
    ...overrides,
  } as ShrineContent;
}

describe('worldNodeShrineLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to 0 when the node has no stored level', () => {
    vi.mocked(gamestate).mockReturnValue({ shrines: {} } as unknown as GameState);

    expect(worldNodeShrineLevel("Founder's Shrine")).toBe(0);
  });

  it('returns the stored level', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { "Founder's Shrine": { level: 2 } },
    } as unknown as GameState);

    expect(worldNodeShrineLevel("Founder's Shrine")).toBe(2);
  });

  it('defaults to 0 when the shrines slice itself is missing (mid-migration, pre-old-save)', () => {
    vi.mocked(gamestate).mockReturnValue({} as unknown as GameState);

    expect(worldNodeShrineLevel("Founder's Shrine")).toBe(0);
  });
});

describe('worldNodeShrineMaxAchievableLevel', () => {
  it('is levels.length - 1', () => {
    expect(worldNodeShrineMaxAchievableLevel(buildShrine())).toBe(2);
  });
});

describe('worldNodeShrineIsMaxLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false below the max achievable level', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 1 } },
    } as unknown as GameState);

    expect(worldNodeShrineIsMaxLevel(buildShrine(), 'Node')).toBe(false);
  });

  it('is true at or above the max achievable level', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 2 } },
    } as unknown as GameState);

    expect(worldNodeShrineIsMaxLevel(buildShrine(), 'Node')).toBe(true);
  });
});

describe('worldNodeShrineLevelUpCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the costs authored at the current level', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 0 } },
    } as unknown as GameState);

    expect(worldNodeShrineLevelUpCost(buildShrine(), 'Node')).toEqual([
      { itemId: 'Gold Coin', required: 500 },
    ]);
  });

  it('returns an empty array once past the last authored tier', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 99 } },
    } as unknown as GameState);

    expect(worldNodeShrineLevelUpCost(buildShrine(), 'Node')).toEqual([]);
  });
});

describe('worldNodeShrineCurrentTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves tier I at level 0, with no offset', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 0 } },
    } as unknown as GameState);

    expect(worldNodeShrineCurrentTier(buildShrine(), 'Node')?.globalEffectId).toBe(
      'Wisdom of the Founder I',
    );
  });

  it('resolves tier V at the max level', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 2 } },
    } as unknown as GameState);

    expect(worldNodeShrineCurrentTier(buildShrine(), 'Node')?.globalEffectId).toBe(
      'Wisdom of the Founder III',
    );
  });

  it('is undefined when the shrine has no authored levels', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 0 } },
    } as unknown as GameState);

    expect(
      worldNodeShrineCurrentTier(buildShrine({ levels: [] }), 'Node'),
    ).toBeUndefined();
  });
});

describe('isPartyAtShrine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true when the party is standing on that node', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: "Founder's Shrine",
    } as WorldNodeEntry);

    expect(isPartyAtShrine("Founder's Shrine")).toBe(true);
  });

  it('is false when the party is elsewhere', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue({
      nodeName: "Merchant's Shrine",
    } as WorldNodeEntry);

    expect(isPartyAtShrine("Founder's Shrine")).toBe(false);
  });
});

describe('pruneInvalidShrineLevels', () => {
  it('drops entries whose node no longer resolves to shrine content', () => {
    const result = pruneInvalidShrineLevels(
      { "Founder's Shrine": { level: 1 }, Removed: { level: 1 } },
      (nodeName) =>
        nodeName === "Founder's Shrine" ? buildShrine() : undefined,
    );

    expect(result).toEqual({ "Founder's Shrine": { level: 1 } });
  });

  it('clamps a stored level down to the current authored max achievable level', () => {
    const result = pruneInvalidShrineLevels(
      { "Founder's Shrine": { level: 5 } },
      () => buildShrine({ levels: [{ costs: [] }] as ShrineLevel[] }),
    );

    expect(result).toEqual({ "Founder's Shrine": { level: 0 } });
  });
});
