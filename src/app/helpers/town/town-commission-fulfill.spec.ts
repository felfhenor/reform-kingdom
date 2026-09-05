import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/commission/commission-requirement', () => ({
  buildCommissionRequirementEntries: vi.fn(() => []),
  commissionRequirementsSatisfied: vi.fn(),
}));

vi.mock('@helpers/commission/commission-turn-in', () => ({
  spendCommissionRequirements: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSafeSegment: (value: string) => value.replace(/\s+/g, ''),
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  canPartyTravel: vi.fn(() => true),
  travelEtaSecondsTo: vi.fn(() => undefined),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/reputation/town-reputation', () => ({
  townReputationGain: vi.fn(),
}));

vi.mock('@helpers/town/town-visit', () => ({
  isPartyAtTown: vi.fn(() => true),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeTown: vi.fn(),
}));

import {
  buildCommissionRequirementEntries,
  commissionRequirementsSatisfied,
} from '@helpers/commission/commission-requirement';
import { spendCommissionRequirements } from '@helpers/commission/commission-turn-in';
import { getEntry } from '@helpers/content/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townReputationGain } from '@helpers/town/reputation/town-reputation';
import {
  townCommissionCanFulfill,
  townCommissionFulfill,
  townCommissionReputationReward,
  townCommissionRequirementEntries,
  townCommissionRowViewModels,
} from '@helpers/town/town-commission-fulfill';
import { isPartyAtTown } from '@helpers/town/town-visit';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  GameState,
  ItemId,
  TownCommissionSlotId,
  TownContent,
  TownId,
  WorldNodeEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;
const slotId = 'slot-1' as TownCommissionSlotId;

const offer: CommissionOfferContent = {
  id: 'offer-a' as CommissionOfferId,
  name: 'Commission - Wergen Sticks',
  __type: 'commissionoffer',
  description: 'A commission.',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 100, quantityMax: 100 },
  ],
  rewards: [],
  townReputationReward: 25,
};

const persistentOffer: CommissionOfferContent = {
  ...offer,
  id: 'offer-persistent' as CommissionOfferId,
  name: 'Commission - Larsian Coffers',
};

function withTownState(state: unknown): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { towns: { [townId]: state } },
  } as unknown as GameState);
}

describe('townCommissionRequirementEntries / townCommissionReputationReward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves requirement entries for an existing slot', () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(buildCommissionRequirementEntries).mockReturnValue([
      {
        kind: 'item',
        content: undefined,
        spritesheet: 'item',
        quantity: 100,
        owned: 0,
      },
    ]);

    expect(townCommissionRequirementEntries(townId, slotId)).toHaveLength(1);
  });

  it('returns an empty list when the slot no longer exists', () => {
    withTownState({ commissionSlots: [] });

    expect(townCommissionRequirementEntries(townId, slotId)).toEqual([]);
  });

  it('resolves the offer reputation reward for an existing slot', () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(getEntry).mockReturnValue(offer);

    expect(townCommissionReputationReward(townId, slotId)).toBe(25);
  });

  it('is 0 when the slot no longer exists', () => {
    withTownState({ commissionSlots: [] });

    expect(townCommissionReputationReward(townId, slotId)).toBe(0);
  });
});

describe('townCommissionCanFulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false when the slot does not exist', () => {
    withTownState({ commissionSlots: [] });

    expect(townCommissionCanFulfill(townId, slotId)).toBe(false);
  });

  it('defers to commissionRequirementsSatisfied for an existing slot', () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(true);

    expect(townCommissionCanFulfill(townId, slotId)).toBe(true);
  });
});

describe('townCommissionRowViewModels', () => {
  const entry = { nodeName: 'Larsia' } as WorldNodeEntry;
  const town: TownContent = {
    id: townId,
    name: 'Larsia',
    __type: 'town',
    defense: {
      quests: {
        commissions: [
          { commissionOfferId: offer.id, weight: 1, persistent: false },
          {
            commissionOfferId: persistentOffer.id,
            weight: 1,
            persistent: true,
          },
        ],
      },
    },
  } as TownContent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPartyAtTown).mockReturnValue(true);
    vi.mocked(canPartyTravel).mockReturnValue(true);
    vi.mocked(travelEtaSecondsTo).mockReturnValue(undefined);
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(true);
  });

  it('returns no rows when the node is not a town', () => {
    vi.mocked(worldNodeTown).mockReturnValue(undefined);

    expect(townCommissionRowViewModels(entry)).toEqual([]);
  });

  it('builds one row per active slot', () => {
    vi.mocked(worldNodeTown).mockReturnValue(town);
    withTownState({
      commissionSlots: [
        {
          id: 'slot-1' as TownCommissionSlotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
        {
          id: 'slot-2' as TownCommissionSlotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(getEntry).mockReturnValue(offer);

    const rows = townCommissionRowViewModels(entry);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      townId,
      slotId: 'slot-1',
      nodeName: 'Larsia',
      title: 'Larsia',
      rewards: [],
      reputationReward: 25,
      completed: false,
      isPartyHere: true,
      canTravel: true,
    });
    expect(rows[1].slotId).toBe('slot-2');
  });

  it('sorts a persistent slot to the top even when generated after the others', () => {
    vi.mocked(worldNodeTown).mockReturnValue(town);
    withTownState({
      commissionSlots: [
        {
          id: 'slot-rolled' as TownCommissionSlotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
        {
          id: 'slot-persistent' as TownCommissionSlotId,
          commissionOfferId: persistentOffer.id,
          requirements: [],
          generatedAtTick: 1,
        },
      ],
    });
    vi.mocked(getEntry).mockImplementation((id: string) =>
      id === persistentOffer.id ? persistentOffer : offer,
    );

    const rows = townCommissionRowViewModels(entry);

    expect(rows.map((row) => row.slotId)).toEqual([
      'slot-persistent',
      'slot-rolled',
    ]);
  });
});

describe('townCommissionFulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPartyAtTown).mockReturnValue(true);
  });

  it('returns false when the party is not at the town', async () => {
    vi.mocked(isPartyAtTown).mockReturnValue(false);
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(true);

    expect(await townCommissionFulfill(townId, slotId)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false when requirements are unmet', async () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(false);

    expect(await townCommissionFulfill(townId, slotId)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('spends requirements, grants reputation instead of rewards, and removes the fulfilled slot', async () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(true);
    vi.mocked(getEntry).mockReturnValue(offer);

    const resultPromise = townCommissionFulfill(townId, slotId);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      world: {
        towns: {
          [townId]: {
            commissionSlots: [
              {
                id: slotId,
                commissionOfferId: offer.id,
                requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
                generatedAtTick: 0,
              },
            ],
          },
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(await resultPromise).toBe(true);
    expect(spendCommissionRequirements).toHaveBeenCalledWith(state, [
      { itemId: 'wergen-stick', quantity: 100 },
    ]);
    expect(result.world.towns[townId].commissionSlots).toEqual([]);
    expect(townReputationGain).toHaveBeenCalledWith(townId, 25, 'Commission');
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Town:Commission:Fulfill:Commission-WergenSticks',
    );
  });

  it('does not double-remove the slot when two turn-ins race before either commits', async () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(true);
    vi.mocked(getEntry).mockReturnValue(offer);

    const call1 = townCommissionFulfill(townId, slotId);
    const call2 = townCommissionFulfill(townId, slotId);

    const [updateFn1, updateFn2] = vi
      .mocked(updateGamestate)
      .mock.calls.map((call) => call[0]);

    const initialState = {
      world: {
        towns: {
          [townId]: {
            commissionSlots: [
              {
                id: slotId,
                commissionOfferId: offer.id,
                requirements: [],
                generatedAtTick: 0,
              },
            ],
          },
        },
      },
    } as unknown as GameState;

    const afterFirst = updateFn1(initialState);
    const afterSecond = updateFn2(afterFirst);

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(afterSecond.world.towns[townId].commissionSlots).toEqual([]);
    expect(spendCommissionRequirements).toHaveBeenCalledTimes(1);
    expect(townReputationGain).toHaveBeenCalledTimes(1);
  });
});
