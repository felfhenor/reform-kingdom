import type * as TownWorkerRosterHelper from '@helpers/town/worker/town-worker-roster';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldTownsState: () => gamestate().world.towns,
  };
});

vi.mock('@helpers/town/worker/town-worker-roster', async (importOriginal) => {
  const actual = await importOriginal<typeof TownWorkerRosterHelper>();
  return {
    ...actual,
    townWorkerRosterMaterialize: vi.fn((_town, existing) => existing),
  };
});

import { getEntry } from '@helpers/content/content';
import { pruneInvalidTowns } from '@helpers/town/town-prune';
import { townWorkerRosterMaterialize } from '@helpers/town/worker/town-worker-roster';
import type {
  GameStateTowns,
  ItemId,
  TownContent,
  TownId,
  WorkerId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const darwinId = 'darwin' as WorkerId;
const oreId = 'copper-ore' as ItemId;

const town: TownContent = {
  id: townId,
  name: 'Larsia',
  __type: 'town',
  description: 'A desert town.',
  hidden: false,
  invisibleUntilCollectibleIdsFound: [],
  scaleType: 'City',
  level: 25,
  materialThresholds: [],
  crafting: {
    maxQueueSize: [{ tier: 0, value: 12 }],
    specialtyTradeskillId: 'jewelcrafting' as never,
    craftingDurationMultiplier: 3,
    craftingChanceOnTick: 3,
    craftingChanceItemThreshold: 4,
    tradeskillLevels: [],
    uniqueRecipeIds: [],
    bannedRecipeIds: [],
  },
  traders: {
    sellItemCount: [{ tier: 0, value: 10 }],
    itemExpirationTimer: 0,
    markupPercentages: { sell: 25, buy: -15 },
  },
  gathering: {
    gatherRateMultiplier: 5,
    goldGatheredPerMaterial: 5,
    workers: [{ workerId: darwinId, level: 1 }],
  },
  reputation: {
    buff: { globalEffectId: 'larsian-influence' as never, tiers: [] },
  },
  defense: {
    rewards: [],
    guardian: {
      reputationTiers: [
        {
          tier: 0,
          guardians: [{ monsterId: 'Larsian Citizen' as never, quantity: 3 }],
        },
      ],
    },
    assaulter: { numMonsters: 15, monsterIds: [], level: { min: 20, max: 25 } },
    quests: { commissions: [] },
    buyoff: { tributeGoldScalar: 0, fortifyMaterials: [] },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pruneInvalidTowns', () => {
  it('keeps entries that resolve to real content', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual(towns);
  });

  it('drops entries whose id no longer resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual({});
  });

  it('backfills missing stock/workers/reputation/hiddenGold on a legacy entry', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns = {
      [townId]: { lastProcessedTick: {} },
    } as unknown as GameStateTowns;

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    });
  });

  it('backfills a missing lastProcessedTick so the town tick gate does not throw', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns = { [townId]: {} } as unknown as GameStateTowns;

    expect(pruneInvalidTowns(towns)[townId].lastProcessedTick).toEqual({});
  });

  it('preserves existing lastProcessedTick progress', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns = {
      [townId]: { lastProcessedTick: { worker: 42 } },
    } as unknown as GameStateTowns;

    expect(pruneInvalidTowns(towns)[townId].lastProcessedTick).toEqual({
      worker: 42,
    });
  });

  it('preserves existing reputation, hiddenGold, and materials', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 350,
        hiddenGold: 1200,
        materials: { [oreId]: 8 },
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    const result = pruneInvalidTowns(towns)[townId];
    expect(result.reputation).toBe(350);
    expect(result.hiddenGold).toBe(1200);
    expect(result.materials).toEqual({ [oreId]: 8 });
  });

  it('drops material entries whose itemId no longer resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === townId ? town : undefined,
    );
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: { [oreId]: 5 },
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    const result = pruneInvalidTowns(towns)[townId];
    expect(result.materials).toEqual({});
  });

  it('drops stock entries whose referenced equipment no longer resolves', () => {
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === townId ? town : undefined,
    );
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [
          {
            equipmentItem: { equipmentId: 'removed-equipment' } as never,
            addedAtTick: 0,
          },
        ],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    });
  });

  it('drops worker state for a WorkerId no longer in the roster', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    const removedId = 'removed' as WorkerId;
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {
          [darwinId]: { level: 1 } as never,
          [removedId]: { level: 1 } as never,
        },
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: { [darwinId]: { level: 1 } },
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    });
  });

  it('materializes any newly-authored roster entries on an already-activated town', () => {
    vi.mocked(getEntry).mockReturnValue(town);
    vi.mocked(townWorkerRosterMaterialize).mockReturnValue({
      [darwinId]: { level: 1 },
    } as never);
    const towns: GameStateTowns = {
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: {},
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    };

    expect(pruneInvalidTowns(towns)).toEqual({
      [townId]: {
        lastProcessedTick: {},
        stock: [],
        workers: { [darwinId]: { level: 1 } },
        reputation: 0,
        hiddenGold: 0,
        materials: {},
        tradeskills: {},
        craftQueue: [],
        commissionSlots: [],
        specialtyPriority: [],
      },
    });
    expect(townWorkerRosterMaterialize).toHaveBeenCalledWith(town, {});
  });
});
