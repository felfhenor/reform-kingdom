import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/caravan/caravan', () => ({
  isPartyAtCaravan: vi.fn(() => true),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelEtaSecondsTo: vi.fn(() => undefined),
}));

vi.mock('@helpers/item/materials', () => ({
  applyMaterialDelta: vi.fn(),
  getMaterialQuantity: vi.fn(),
  traderTokenId: vi.fn(() => 'trader-token'),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(),
}));

import { isPartyAtCaravan } from '@helpers/caravan/caravan';
import {
  commissionCanFulfill,
  commissionExists,
  commissionFulfill,
  commissionRequirementEntries,
  commissionRowViewModel,
  commissionTokenReward,
} from '@helpers/commission/commission-fulfill';
import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { travelEtaSecondsTo } from '@helpers/hero/travel';
import { applyMaterialDelta, getMaterialQuantity } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CommissionOfferContent,
  CommissionOfferId,
  EquipmentContent,
  EquipmentId,
  GameState,
  ItemContent,
  ItemId,
  WorldNodeEntry,
} from '@interfaces';

const caravanId = 'carrina-duchy' as CaravanId;

const offer: CommissionOfferContent = {
  id: 'offer-a' as CommissionOfferId,
  name: 'Commission - Wergen Sticks',
  __type: 'commissionoffer',
  description: 'A commission.',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 100, quantityMax: 100 },
  ],
  tokenReward: 2,
};

const wergenStick: ItemContent = {
  id: 'wergen-stick' as ItemId,
  name: 'Wergen Stick',
  __type: 'item',
  description: 'A stick.',
  sprite: '0000',
  rarity: 'Common',
};

const sword: EquipmentContent = {
  id: 'sword' as EquipmentId,
  name: 'Sword',
  __type: 'equipment',
  description: 'A sword.',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: {} as never,
  type: 'Sword',
  slots: 1,
  grantedSkillIds: [],
};

function withCommissionState(state: unknown): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { commissions: { [caravanId]: state } },
  } as unknown as GameState);
}

describe('commissionRequirementEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty list when no commission exists', () => {
    withCommissionState(undefined);
    expect(commissionRequirementEntries(caravanId)).toEqual([]);
  });

  it('resolves an item requirement with owned quantity', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getEntry).mockReturnValue(wergenStick);
    vi.mocked(getMaterialQuantity).mockReturnValue(40);

    expect(commissionRequirementEntries(caravanId)).toEqual([
      {
        kind: 'item',
        content: wergenStick,
        spritesheet: 'item',
        quantity: 100,
        owned: 40,
      },
    ]);
  });

  it('resolves an equipment requirement with owned count from the armory', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ equipmentId: sword.id, quantity: 2 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getEntry).mockReturnValue(sword);
    vi.mocked(armoryGet).mockReturnValue([
      { equipmentId: sword.id, id: 'a', infusedItemIds: [] },
      { equipmentId: sword.id, id: 'b', infusedItemIds: [] },
      { equipmentId: 'other' as EquipmentId, id: 'c', infusedItemIds: [] },
    ] as never);

    expect(commissionRequirementEntries(caravanId)).toEqual([
      {
        kind: 'equipment',
        content: sword,
        spritesheet: 'equipment',
        quantity: 2,
        owned: 2,
      },
    ]);
  });
});

describe('commissionExists / commissionTokenReward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commissionExists is false with no commission generated yet', () => {
    withCommissionState(undefined);
    expect(commissionExists(caravanId)).toBe(false);
  });

  it('commissionExists is true once an offer has been rolled', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [],
      completed: false,
      generatedAt: 1000,
    });
    expect(commissionExists(caravanId)).toBe(true);
  });

  it('commissionTokenReward resolves the offer reward', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getEntry).mockReturnValue(offer);

    expect(commissionTokenReward(caravanId)).toBe(2);
  });

  it('commissionTokenReward is 0 with no active commission', () => {
    withCommissionState(undefined);
    expect(commissionTokenReward(caravanId)).toBe(0);
  });
});

describe('commissionCanFulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false when no commission exists', () => {
    withCommissionState(undefined);
    expect(commissionCanFulfill(caravanId)).toBe(false);
  });

  it('is false when already completed', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: true,
      generatedAt: 1000,
    });
    expect(commissionCanFulfill(caravanId)).toBe(false);
  });

  it('is false when a requirement is short', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(50);

    expect(commissionCanFulfill(caravanId)).toBe(false);
  });

  it('is true when every requirement is met', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(100);

    expect(commissionCanFulfill(caravanId)).toBe(true);
  });

  it('is true when an equipment requirement is met from the armory', () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ equipmentId: sword.id, quantity: 1 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(armoryGet).mockReturnValue([
      { equipmentId: sword.id, id: 'a', infusedItemIds: [] },
    ] as never);

    expect(commissionCanFulfill(caravanId)).toBe(true);
  });

  it('does not require the party to be at the caravan - that only gates the actual turn-in', () => {
    vi.mocked(isPartyAtCaravan).mockReturnValue(false);
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(100);

    expect(commissionCanFulfill(caravanId)).toBe(true);
  });
});

describe('commissionFulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPartyAtCaravan).mockReturnValue(true);
  });

  it('returns false and does not mutate state when requirements are unmet', async () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(0);

    expect(await commissionFulfill(caravanId)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('returns false and does not mutate state when the party is not at the caravan', async () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(100);
    vi.mocked(isPartyAtCaravan).mockReturnValue(false);

    expect(await commissionFulfill(caravanId)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('spends every requirement, grants tokens, and flips completed on success', async () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(100);
    vi.mocked(getEntry).mockReturnValue(offer);

    // updateGamestate is a dumb recorder in this suite (it doesn't actually
    // invoke the callback), so the resolved success/failure of
    // commissionFulfill depends on the callback below having already run
    // before the outer promise is awaited - matching how the double-fire
    // regression test further down feeds committed state through it.
    const resultPromise = commissionFulfill(caravanId);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      materials: { [wergenStick.id]: { quantity: 100, foundAt: 1 } },
      armory: [],
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offer.id,
            requirements: [{ itemId: wergenStick.id, quantity: 100 }],
            completed: false,
            generatedAt: 1000,
          },
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(await resultPromise).toBe(true);
    expect(applyMaterialDelta).toHaveBeenCalledWith(
      state,
      wergenStick.id,
      -100,
    );
    expect(applyMaterialDelta).toHaveBeenCalledWith(state, 'trader-token', 2);
    expect(result.world.commissions[caravanId].completed).toBe(true);
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Kingdom:Commission:Fulfill',
    );
  });

  it('consumes equipment requirements from the armory instead of materials', async () => {
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ equipmentId: sword.id, quantity: 2 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(armoryGet).mockReturnValue([
      { equipmentId: sword.id, id: 'a', infusedItemIds: [] },
      { equipmentId: sword.id, id: 'b', infusedItemIds: [] },
      { equipmentId: 'other' as EquipmentId, id: 'c', infusedItemIds: [] },
    ] as never);
    vi.mocked(getEntry).mockReturnValue(offer);

    const resultPromise = commissionFulfill(caravanId);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = {
      materials: {},
      armory: [
        { equipmentId: sword.id, id: 'a', infusedItemIds: [] },
        { equipmentId: sword.id, id: 'b', infusedItemIds: [] },
        { equipmentId: 'other' as EquipmentId, id: 'c', infusedItemIds: [] },
      ],
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offer.id,
            requirements: [{ equipmentId: sword.id, quantity: 2 }],
            completed: false,
            generatedAt: 1000,
          },
        },
      },
    } as unknown as GameState;
    const result = updateFn(state);

    expect(await resultPromise).toBe(true);
    expect(result.armory).toEqual([
      { equipmentId: 'other' as EquipmentId, id: 'c', infusedItemIds: [] },
    ]);
  });

  it('does not double-grant tokens when two turn-ins race before either commits', async () => {
    // Regression test for the rapid-click double-fire bug: updateGamestate
    // doesn't commit until an async yield later, so commissionCanFulfill's
    // fast-path check (run synchronously before that yield) can pass twice
    // against the same stale, pre-commit state if two calls race in before
    // the first one's callback actually runs.
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getMaterialQuantity).mockReturnValue(100);
    vi.mocked(getEntry).mockReturnValue(offer);

    const call1 = commissionFulfill(caravanId);
    const call2 = commissionFulfill(caravanId);

    expect(updateGamestate).toHaveBeenCalledTimes(2);
    const [updateFn1, updateFn2] = vi
      .mocked(updateGamestate)
      .mock.calls.map((call) => call[0]);

    const initialState = {
      materials: { [wergenStick.id]: { quantity: 100, foundAt: 1 } },
      armory: [],
      world: {
        commissions: {
          [caravanId]: {
            commissionOfferId: offer.id,
            requirements: [{ itemId: wergenStick.id, quantity: 100 }],
            completed: false,
            generatedAt: 1000,
          },
        },
      },
    } as unknown as GameState;

    // Simulates commit ordering: call1's callback commits first; call2's
    // callback then runs against that already-committed result, as it would
    // once its own updateGamestate yield resolves.
    const afterFirst = updateFn1(initialState);
    const afterSecond = updateFn2(afterFirst);

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(afterSecond).toBe(afterFirst);
    expect(afterFirst.world.commissions[caravanId].completed).toBe(true);
    // One spend + one grant from call1; call2 must no-op entirely.
    expect(applyMaterialDelta).toHaveBeenCalledTimes(2);
  });
});

describe('commissionRowViewModel', () => {
  const entry = { nodeName: 'Duchy Trading Caravan - Carrina' } as WorldNodeEntry;
  const caravan: CaravanContent = {
    id: caravanId,
    name: 'Duchy Trading Caravan - Carrina',
    __type: 'caravan',
    description: 'A caravan.',
    traderResetTime: 100,
    level: { min: 1, max: 10 },
    markupPercentages: { sell: 25, buy: -15 },
    traderCategories: ['Carrina'],
    commissionOffers: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPartyAtCaravan).mockReturnValue(true);
    vi.mocked(travelEtaSecondsTo).mockReturnValue(undefined);
  });

  it('returns undefined when the node is not a caravan', () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(undefined);

    expect(commissionRowViewModel(entry)).toBeUndefined();
  });

  it('returns undefined when no commission has been generated yet', () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    withCommissionState(undefined);

    expect(commissionRowViewModel(entry)).toBeUndefined();
  });

  it('resolves a full row once a commission is active', () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [{ itemId: wergenStick.id, quantity: 100 }],
      completed: false,
      generatedAt: 1000,
    });
    vi.mocked(getEntry).mockImplementation((id) =>
      (id === offer.id ? offer : wergenStick) as never,
    );
    vi.mocked(getMaterialQuantity).mockReturnValue(100);

    expect(commissionRowViewModel(entry)).toEqual({
      caravanId: caravan.id,
      nodeName: entry.nodeName,
      caravanName: caravan.name,
      requirementEntries: [
        {
          kind: 'item',
          content: wergenStick,
          spritesheet: 'item',
          quantity: 100,
          owned: 100,
        },
      ],
      tokenReward: 2,
      canFulfill: true,
      completed: false,
      isPartyHere: true,
      travelEtaSeconds: undefined,
    });
  });

  it('reflects a completed commission and an in-progress travel ETA', () => {
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    withCommissionState({
      commissionOfferId: offer.id,
      requirements: [],
      completed: true,
      generatedAt: 1000,
    });
    vi.mocked(isPartyAtCaravan).mockReturnValue(false);
    vi.mocked(travelEtaSecondsTo).mockReturnValue(42);

    const row = commissionRowViewModel(entry);

    expect(row?.completed).toBe(true);
    expect(row?.isPartyHere).toBe(false);
    expect(row?.travelEtaSeconds).toBe(42);
  });
});
