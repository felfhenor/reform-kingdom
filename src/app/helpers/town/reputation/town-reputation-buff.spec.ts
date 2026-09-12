import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(() => 100),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { updateGamestate } from '@helpers/state-game';
import {
  townReputationBuffEffects,
  townReputationBuffSync,
} from '@helpers/town/reputation/town-reputation-buff';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  GameState,
  GlobalEffectContent,
  GlobalEffectId,
  TownContent,
  TownId,
  TownReputationBuffTier,
  WorldNodeEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;
const buffId = 'larsian-influence' as GlobalEffectId;

const buffContent: GlobalEffectContent = {
  id: buffId,
  name: 'Larsian Influence',
  __type: 'globaleffect',
  sprite: '0010',
  description: 'The influence of Larsia, the kingdom in the desert.',
  effects: [],
};

function buildTier(
  overrides: Partial<TownReputationBuffTier> = {},
): TownReputationBuffTier {
  return {
    tier: 1,
    stats: defaultStats(),
    combatStats: defaultCombatStats(),
    debuffResistances: defaultTagResistances(),
    ...overrides,
  };
}

function buildTown(overrides: Partial<TownContent> = {}): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    __type: 'town',
    reputation: {
      buff: {
        globalEffectId: buffId,
        tiers: [
          buildTier({ tier: 1, stats: { ...defaultStats(), Strength: 1 } }),
        ],
      },
    },
    ...overrides,
  } as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntry).mockReturnValue(buffContent);
});

describe('townReputationBuffEffects', () => {
  it('emits only the non-zero stat/combatStat/resistance entries', () => {
    const tier = buildTier({
      stats: { ...defaultStats(), Strength: 1 },
      combatStats: { ...defaultCombatStats(), reviveChance: 2 },
      debuffResistances: { ...defaultTagResistances(), Accuracy: 5 },
    });

    expect(townReputationBuffEffects(tier)).toEqual([
      { effectType: 'GainStats', stat: 'Strength', value: 1 },
      { effectType: 'GainCombatStat', combatStat: 'reviveChance', value: 2 },
      { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 5 },
    ]);
  });

  it('returns an empty array for an all-zero tier', () => {
    expect(townReputationBuffEffects(buildTier())).toEqual([]);
  });
});

describe('townReputationBuffSync', () => {
  it('does nothing when the map has not actually changed', () => {
    townReputationBuffSync('Carrina', 'Carrina');

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it("adds the town's real content, with only effects computed per-tier, on entering its map", () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'LarsianDesert',
      x: 5,
      y: 9,
    } as WorldNodeEntry);
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
      globalEffects: [],
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    townReputationBuffSync('Carrina', 'LarsianDesert');

    expect(state.globalEffects).toEqual([
      expect.objectContaining({
        id: buffId,
        name: 'Larsian Influence',
        sprite: '0010',
        description: 'The influence of Larsia, the kingdom in the desert.',
        extendedDescription: 'Strength: +1',
        effects: [{ effectType: 'GainStats', stat: 'Strength', value: 1 }],
      }),
    ]);
  });

  it('removes the buff on leaving the map it was granted for', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'LarsianDesert',
      x: 5,
      y: 9,
    } as WorldNodeEntry);
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
      globalEffects: [{ id: buffId, name: 'Larsian Influence' }],
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    townReputationBuffSync('LarsianDesert', 'Carrina');

    expect(state.globalEffects).toEqual([]);
  });

  it('grants no buff at Neutral (tier 0 is never authored)', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'LarsianDesert',
      x: 5,
      y: 9,
    } as WorldNodeEntry);
    const state = {
      world: { towns: { [townId]: { reputation: 0 } } },
      globalEffects: [],
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    townReputationBuffSync('Carrina', 'LarsianDesert');

    expect(state.globalEffects).toEqual([]);
  });

  it('skips a town whose node can no longer be resolved on the map', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
    vi.mocked(worldNodeByName).mockReturnValue(undefined);
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
      globalEffects: [],
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    townReputationBuffSync('Carrina', 'LarsianDesert');

    expect(state.globalEffects).toEqual([]);
  });

  it("grants no buff when the town's globalEffectId no longer resolves to real content", () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
    vi.mocked(getEntry).mockReturnValue(undefined);
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'LarsianDesert',
      x: 5,
      y: 9,
    } as WorldNodeEntry);
    const state = {
      world: { towns: { [townId]: { reputation: 100 } } },
      globalEffects: [],
    } as unknown as GameState;
    vi.mocked(updateGamestate).mockImplementation(async (fn) => {
      fn(state);
    });

    townReputationBuffSync('Carrina', 'LarsianDesert');

    expect(state.globalEffects).toEqual([]);
  });
});
