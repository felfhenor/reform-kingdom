import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    shrinesState: () => gamestate().shrines,
  };
});

import { gamestate } from '@helpers/state-game';
import {
  worldNodeShrineCurrentTier,
  worldNodeShrineLevel,
} from '@helpers/world-node/world-node-shrine';
import type {
  GameState,
  GlobalEffectId,
  ItemId,
  ShrineContent,
  ShrineLevel,
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
    vi.mocked(gamestate).mockReturnValue({
      shrines: {},
    } as unknown as GameState);

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

describe('worldNodeShrineCurrentTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is undefined at level 0 - no investment made, so not prayable', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 0 } },
    } as unknown as GameState);

    expect(worldNodeShrineCurrentTier(buildShrine(), 'Node')).toBeUndefined();
  });

  it('resolves tier I at level 1', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 1 } },
    } as unknown as GameState);

    expect(
      worldNodeShrineCurrentTier(buildShrine(), 'Node')?.globalEffectId,
    ).toBe('Wisdom of the Founder I');
  });

  it('resolves tier III at the max level', () => {
    vi.mocked(gamestate).mockReturnValue({
      shrines: { Node: { level: 3 } },
    } as unknown as GameState);

    expect(
      worldNodeShrineCurrentTier(buildShrine(), 'Node')?.globalEffectId,
    ).toBe('Wisdom of the Founder III');
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
