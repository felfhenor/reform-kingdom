import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import {
  townGuardianMonsterIds,
  townGuardiansForCurrentReputation,
} from '@helpers/town/town-guardian';
import type { GameState, MonsterId, TownContent, TownId } from '@interfaces';

const citizenId = 'larsian-citizen' as MonsterId;
const guardId = 'larsian-guard' as MonsterId;
const townId = 'larsia' as TownId;

function buildTown(overrides: Partial<TownContent> = {}): TownContent {
  return {
    id: townId,
    name: 'Larsia',
    __type: 'town',
    description: 'A desert town.',
    hidden: false,
    invisibleUntilCollectibleIdsFound: [],
    scaleType: 'City',
    level: 25,
    crafting: {
      maxQueueSize: [{ tier: 0, value: 1 }],
      specialtyTradeskillId: 'jewelcrafting' as never,
      craftingDurationMultiplier: 1,
      craftingChanceOnTick: 1,
      craftingChanceItemThreshold: 1,
      tradeskillLevels: [],
      uniqueRecipeIds: [],
    },
    traders: {
      sellItemCount: [{ tier: 0, value: 0 }],
      markupPercentages: { sell: 0, buy: 0 },
    },
    gathering: {
      gatherRateMultiplier: 1,
      goldGatheredPerMaterial: 0,
      materialThresholds: [],
      workers: [],
    },
    reputation: { buff: { globalEffectId: 'unknown' as never, tiers: [] } },
    defense: {
      rewards: [],
      guardian: {
        reputationTiers: [
          { tier: 0, guardians: [{ monsterId: citizenId, quantity: 3 }] },
          {
            tier: 1,
            guardians: [
              { monsterId: citizenId, quantity: 2 },
              { monsterId: guardId, quantity: 1 },
            ],
          },
        ],
      },
      assaulter: { numMonsters: 0, monsterIds: [], level: { min: 1, max: 1 } },
      quests: { commissions: [] },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townGuardianMonsterIds', () => {
  it('collects every distinct monster id across all towns and tiers', () => {
    vi.mocked(getEntriesByType).mockReturnValue([buildTown()] as never);

    expect(townGuardianMonsterIds()).toEqual([citizenId, guardId]);
  });

  it('returns an empty list when no towns are authored', () => {
    vi.mocked(getEntriesByType).mockReturnValue([]);

    expect(townGuardianMonsterIds()).toEqual([]);
  });
});

describe('townGuardiansForCurrentReputation', () => {
  it("resolves the tier matching the town's current reputation", () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { reputation: 100 } } },
    } as unknown as GameState);

    expect(townGuardiansForCurrentReputation(buildTown())).toEqual([
      { monsterId: citizenId, quantity: 2 },
      { monsterId: guardId, quantity: 1 },
    ]);
  });

  it('returns an empty list when no tier is authored at the current reputation', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { reputation: 100 } } },
    } as unknown as GameState);

    const town = buildTown({
      defense: {
        rewards: [],
        guardian: { reputationTiers: [] },
        assaulter: {
          numMonsters: 0,
          monsterIds: [],
          level: { min: 1, max: 1 },
        },
        quests: { commissions: [] },
      },
    });

    expect(townGuardiansForCurrentReputation(town)).toEqual([]);
  });
});
