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
  EligibleCommissionOffer,
  GameState,
  ItemId,
  TownCommissionOfferSlot,
  TownContent,
  TownId,
} from '@interfaces';

function buildTown(
  commissions: TownCommissionOfferSlot[],
): TownContent {
  return {
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
      quests: { commissions },
    },
  };
}

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

const persistentOffer: CommissionOfferContent = {
  ...offer,
  id: 'offer-persistent' as CommissionOfferId,
  name: 'Commission - Larsian Coffers',
};

const town = buildTown([
  { commissionOfferId: offer.id, weight: 1, persistent: false },
]);

// Mirrors the real eligibleCommissionOffers (slot -> resolved content), without going through getEntry.
function stubEligibleOffers(offers: CommissionOfferContent[]): void {
  const byId = new Map(offers.map((o) => [o.id, o]));
  vi.mocked(eligibleCommissionOffers).mockImplementation((slots) =>
    slots
      .map((slot) => {
        const found = byId.get(slot.commissionOfferId);
        return found ? { offer: found, weight: slot.weight } : undefined;
      })
      .filter((entry): entry is EligibleCommissionOffer => !!entry),
  );
}

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
    stubEligibleOffers([offer]);
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

  describe('persistent commissions', () => {
    const persistentTown = buildTown([
      { commissionOfferId: persistentOffer.id, weight: 1, persistent: true },
    ]);

    beforeEach(() => {
      vi.mocked(getEntriesByType).mockReturnValue([persistentTown]);
      stubEligibleOffers([persistentOffer]);
    });

    it('adds a slot for a persistent offer even when no rolled offer is eligible', () => {
      vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);
      vi.mocked(rollCommissionRequirements).mockReturnValue([]);

      townCommissionProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = {
        world: { towns: { [persistentTown.id]: { commissionSlots: [] } } },
      } as unknown as GameState;
      updateFn(state);

      expect(state.world.towns[persistentTown.id].commissionSlots).toEqual([
        {
          id: 'slot-uuid',
          commissionOfferId: persistentOffer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ]);
    });

    it('does not duplicate a persistent offer that already has a live slot', () => {
      vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

      townCommissionProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = {
        world: {
          towns: {
            [persistentTown.id]: {
              commissionSlots: [
                {
                  id: 'existing-persistent',
                  commissionOfferId: persistentOffer.id,
                  requirements: [],
                  generatedAtTick: 0,
                },
              ],
            },
          },
        },
      } as unknown as GameState;
      updateFn(state);

      expect(state.world.towns[persistentTown.id].commissionSlots).toHaveLength(
        1,
      );
      expect(
        state.world.towns[persistentTown.id].commissionSlots[0].id,
      ).toBe('existing-persistent');
    });

    it('excludes persistent offers from the weighted roll pool and does not count them against the cap', () => {
      const mixedTown = buildTown([
        { commissionOfferId: persistentOffer.id, weight: 1, persistent: true },
        { commissionOfferId: offer.id, weight: 1, persistent: false },
      ]);
      vi.mocked(getEntriesByType).mockReturnValue([mixedTown]);
      stubEligibleOffers([persistentOffer, offer]);
      vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

      townCommissionProcessTick();

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const state = {
        world: {
          towns: {
            [mixedTown.id]: {
              commissionSlots: [
                {
                  id: 'existing-persistent',
                  commissionOfferId: persistentOffer.id,
                  requirements: [],
                  generatedAtTick: 0,
                },
              ],
            },
          },
        },
      } as unknown as GameState;
      updateFn(state);

      expect(rngChoiceWeighted).toHaveBeenCalledWith(
        [{ offer, weight: 1 }],
        expect.any(Function),
      );
    });
  });
});
