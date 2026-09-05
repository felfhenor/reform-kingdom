import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/materials', () => ({
  applyMaterialDelta: vi.fn(),
}));

vi.mock('@helpers/item/loot', () => ({
  applyResolvedDropToState: vi.fn(),
  rollDroppedRewards: vi.fn(() => []),
}));

import {
  grantCommissionRewards,
  spendCommissionRequirements,
} from '@helpers/commission/commission-turn-in';
import { applyResolvedDropToState, rollDroppedRewards } from '@helpers/item/loot';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionRequirement,
  EquipmentId,
  EquipmentItem,
  GameState,
  ItemId,
} from '@interfaces';

describe('spendCommissionRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts an item requirement via applyMaterialDelta', () => {
    const state = {} as unknown as GameState;
    const requirements: CommissionRequirement[] = [
      { itemId: 'wergen-stick' as ItemId, quantity: 100 },
    ];

    spendCommissionRequirements(state, requirements);

    expect(applyMaterialDelta).toHaveBeenCalledWith(
      state,
      'wergen-stick',
      -100,
    );
  });

  it('consumes an equipment requirement from the armory', () => {
    const swordId = 'sword' as EquipmentId;
    const armory: EquipmentItem[] = [
      { equipmentId: swordId, id: 'a', infusedItemIds: [] },
      { equipmentId: swordId, id: 'b', infusedItemIds: [] },
      { equipmentId: 'other' as EquipmentId, id: 'c', infusedItemIds: [] },
    ];
    const state = { armory } as unknown as GameState;
    const requirements: CommissionRequirement[] = [
      { equipmentId: swordId, quantity: 2 },
    ];

    spendCommissionRequirements(state, requirements);

    expect(state.armory).toEqual([
      { equipmentId: 'other' as EquipmentId, id: 'c', infusedItemIds: [] },
    ]);
  });

  it('spends nothing for a monster-kill requirement', () => {
    const state = {} as unknown as GameState;
    const requirements: CommissionRequirement[] = [
      { monsterId: 'sand-worm' as never, quantity: 5, progress: 5 },
    ];

    spendCommissionRequirements(state, requirements);

    expect(applyMaterialDelta).not.toHaveBeenCalled();
  });
});

describe('grantCommissionRewards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolls the offer rewards at an inert level and applies each resolved drop', () => {
    const offer: CommissionOfferContent = {
      id: 'offer-a' as CommissionOfferId,
      name: 'Commission - Wergen Sticks',
      __type: 'commissionoffer',
      description: 'A commission.',
      requirements: [],
      rewards: [
        { kind: 'Item', itemId: 'trader-token' as ItemId, chance: 100, min: 2, max: 2 },
      ],
      townReputationReward: 0,
    };
    vi.mocked(rollDroppedRewards).mockReturnValue([
      { kind: 'Item', itemId: 'trader-token' as ItemId, quantity: 2 },
    ]);
    const state = {} as unknown as GameState;

    grantCommissionRewards(state, offer);

    expect(rollDroppedRewards).toHaveBeenCalledWith(offer.rewards, 1);
    expect(applyResolvedDropToState).toHaveBeenCalledWith(state, {
      kind: 'Item',
      itemId: 'trader-token',
      quantity: 2,
    });
  });
});
