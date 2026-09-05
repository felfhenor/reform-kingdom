import type * as TownReputationHelper from '@helpers/town/reputation/town-reputation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/commission/commission-requirement', () => ({
  eligibleCommissionOffers: vi.fn(),
  rollCommissionRequirements: vi.fn(() => []),
}));

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  timerTicksElapsed: vi.fn(() => 0),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
  rngUuid: vi.fn(() => 'slot-uuid'),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation', async (importOriginal) => {
  const actual = await importOriginal<typeof TownReputationHelper>();
  return {
    ...actual,
    townReputationTier: vi.fn(() => 0),
  };
});

vi.mock('@helpers/town/town-tick', () => ({
  isTownDueForUpdate: vi.fn(() => true),
  markTownSubsystemProcessed: vi.fn(),
}));

import {
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { getEntriesByType } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import {
  townCommissionProcessTick,
  townCommissionSlotCount,
} from '@helpers/town/town-commission-generate';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  GameState,
  ItemId,
  TownContent,
  TownId,
} from '@interfaces';

const town: TownContent = {
  id: 'larsia' as TownId,
  name: 'Larsia',
  __type: 'town',
  description: 'A town.',
  hidden: false,
  invisibleUntilCollectibleIdsFound: [],
  scaleType: 'City',
  level: 25,
  crafting: {} as never,
  traders: {} as never,
  gathering: {} as never,
  reputation: {} as never,
  defense: {
    rewards: [],
    guardian: { reputationTiers: [] },
    assaulter: { numMonsters: 0, monsterIds: [], level: { min: 1, max: 1 } },
    quests: { commissions: [{ commissionOfferId: 'offer-a', weight: 1 }] },
  },
};

const offer: CommissionOfferContent = {
  id: 'offer-a' as CommissionOfferId,
  name: 'Commission - Wergen Sticks',
  __type: 'commissionoffer',
  description: 'A commission.',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 100, quantityMax: 100 },
  ],
  rewards: [],
  townReputationReward: 0,
};

describe('townCommissionSlotCount', () => {
  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ])('resolves tier %i to %i slots', (tier, expected) => {
    vi.mocked(townReputationTier).mockReturnValue(tier);
    expect(townCommissionSlotCount(town)).toBe(expected);
  });
});

describe('townCommissionProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntriesByType).mockReturnValue([town]);
    vi.mocked(townReputationTier).mockReturnValue(0);
    vi.mocked(isTownDueForUpdate).mockReturnValue(true);
    vi.mocked(eligibleCommissionOffers).mockReturnValue([
      { offer, weight: 1 },
    ]);
  });

  it('does nothing when the town is not due for its quest tick', () => {
    vi.mocked(isTownDueForUpdate).mockReturnValue(false);

    townCommissionProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(markTownSubsystemProcessed).not.toHaveBeenCalled();
  });

  it('fills empty slots up to the reputation-tier slot count', () => {
    vi.mocked(rngChoiceWeighted).mockReturnValue({ offer, weight: 1 });
    vi.mocked(rollCommissionRequirements).mockReturnValue([
      { itemId: 'wergen-stick' as ItemId, quantity: 100 },
    ]);

    townCommissionProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        towns: {
          [town.id]: { commissionSlots: [] },
        },
      },
    } as unknown as GameState;
    updateFn(state);

    expect(state.world.towns[town.id].commissionSlots).toEqual([
      {
        id: 'slot-uuid',
        commissionOfferId: offer.id,
        requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
        generatedAtTick: 0,
      },
    ]);
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(town.id, 'quest');
  });

  it('does not add slots beyond the reputation-tier slot count', () => {
    vi.mocked(rngChoiceWeighted).mockReturnValue({ offer, weight: 1 });

    townCommissionProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        towns: {
          [town.id]: {
            commissionSlots: [
              {
                id: 'existing',
                commissionOfferId: offer.id,
                requirements: [],
                generatedAtTick: 0,
              },
            ],
          },
        },
      },
    } as unknown as GameState;
    updateFn(state);

    expect(state.world.towns[town.id].commissionSlots).toHaveLength(1);
  });

  it('stops retrying once no eligible offer can be picked', () => {
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    townCommissionProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        towns: {
          [town.id]: { commissionSlots: [] },
        },
      },
    } as unknown as GameState;
    updateFn(state);

    expect(state.world.towns[town.id].commissionSlots).toEqual([]);
  });

  it('no-ops when the town has no state entry yet', () => {
    townCommissionProcessTick();

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = { world: { towns: {} } } as unknown as GameState;

    expect(() => updateFn(state)).not.toThrow();
  });
});
