import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  getMaterialQuantity: vi.fn(),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngNumberRange: vi.fn((min: number) => min),
}));

import {
  buildCommissionRequirementEntries,
  commissionRequirementOwnedQuantity,
  commissionRequirementsSatisfied,
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { getEntry } from '@helpers/content/content';
import { getMaterialQuantity } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionOfferSlot,
  CommissionRequirement,
  EquipmentContent,
  EquipmentId,
  GameState,
  ItemContent,
  ItemId,
  MonsterContent,
  MonsterId,
  RecipeId,
} from '@interfaces';

const offer: CommissionOfferContent = {
  id: 'offer-a' as CommissionOfferId,
  name: 'Commission - Wergen Sticks',
  __type: 'commissionoffer',
  description: 'A commission.',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 10, quantityMax: 20 },
  ],
  rewards: [],
  townReputationReward: 0,
  specialtyForRecipeId: 'UNKNOWN' as RecipeId,
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

const sandWorm: MonsterContent = {
  id: 'sand-worm' as MonsterId,
  name: 'Sand Worm',
  __type: 'monster',
  description: 'A worm.',
  sprite: '0000',
} as unknown as MonsterContent;

describe('eligibleCommissionOffers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves each slot to its offer content and weight', () => {
    const slots: CommissionOfferSlot[] = [
      { commissionOfferId: offer.id, weight: 3 },
    ];
    vi.mocked(getEntry).mockReturnValue(offer);

    expect(eligibleCommissionOffers(slots)).toEqual([
      { offer, weight: 3 },
    ]);
  });

  it('drops a slot whose offer no longer resolves to real content', () => {
    const slots: CommissionOfferSlot[] = [
      { commissionOfferId: offer.id, weight: 3 },
    ];
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(eligibleCommissionOffers(slots)).toEqual([]);
  });
});

describe('rollCommissionRequirements', () => {
  it('rolls an item requirement quantity within its range', () => {
    const result = rollCommissionRequirements(offer);

    expect(result).toEqual([{ itemId: 'wergen-stick', quantity: 10 }]);
  });

  it('rolls an equipment requirement without a progress field', () => {
    const equipmentOffer: CommissionOfferContent = {
      ...offer,
      requirements: [
        { equipmentId: sword.id, quantityMin: 2, quantityMax: 2 },
      ],
    };

    expect(rollCommissionRequirements(equipmentOffer)).toEqual([
      { equipmentId: sword.id, quantity: 2 },
    ]);
  });

  it('rolls a monster-kill requirement starting at zero progress', () => {
    const killOffer: CommissionOfferContent = {
      ...offer,
      requirements: [
        { monsterId: sandWorm.id, quantityMin: 5, quantityMax: 5 },
      ],
    };

    expect(rollCommissionRequirements(killOffer)).toEqual([
      { monsterId: sandWorm.id, quantity: 5, progress: 0 },
    ]);
  });
});

describe('commissionRequirementOwnedQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads live armory count for an equipment requirement with no state given', () => {
    vi.mocked(armoryGet).mockReturnValue([
      { equipmentId: sword.id, id: 'a', infusedItemIds: [] },
    ] as never);
    const requirement: CommissionRequirement = {
      equipmentId: sword.id,
      quantity: 1,
    };

    expect(commissionRequirementOwnedQuantity(requirement)).toBe(1);
  });

  it('reads an explicit commit-time state for an equipment requirement', () => {
    const state = {
      armory: [{ equipmentId: sword.id, id: 'a', infusedItemIds: [] }],
    } as unknown as GameState;
    const requirement: CommissionRequirement = {
      equipmentId: sword.id,
      quantity: 1,
    };

    expect(commissionRequirementOwnedQuantity(requirement, state)).toBe(1);
  });

  it('returns a kill requirement progress directly, ignoring state entirely', () => {
    const requirement: CommissionRequirement = {
      monsterId: sandWorm.id,
      quantity: 5,
      progress: 3,
    };

    expect(commissionRequirementOwnedQuantity(requirement)).toBe(3);
  });

  it('reads live material quantity for an item requirement with no state given', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(40);
    const requirement: CommissionRequirement = {
      itemId: wergenStick.id,
      quantity: 100,
    };

    expect(commissionRequirementOwnedQuantity(requirement)).toBe(40);
  });

  it('reads an explicit commit-time state for an item requirement', () => {
    const state = {
      materials: { [wergenStick.id]: { quantity: 12, foundAt: 1 } },
    } as unknown as GameState;
    const requirement: CommissionRequirement = {
      itemId: wergenStick.id,
      quantity: 100,
    };

    expect(commissionRequirementOwnedQuantity(requirement, state)).toBe(12);
  });
});

describe('commissionRequirementsSatisfied', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is true when every requirement meets its quantity', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(100);
    const requirements: CommissionRequirement[] = [
      { itemId: wergenStick.id, quantity: 100 },
    ];

    expect(commissionRequirementsSatisfied(requirements)).toBe(true);
  });

  it('is false when any requirement is short', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(50);
    const requirements: CommissionRequirement[] = [
      { itemId: wergenStick.id, quantity: 100 },
    ];

    expect(commissionRequirementsSatisfied(requirements)).toBe(false);
  });
});

describe('buildCommissionRequirementEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves an item requirement entry', () => {
    vi.mocked(getEntry).mockReturnValue(wergenStick);
    vi.mocked(getMaterialQuantity).mockReturnValue(40);
    const requirements: CommissionRequirement[] = [
      { itemId: wergenStick.id, quantity: 100 },
    ];

    expect(buildCommissionRequirementEntries(requirements)).toEqual([
      {
        kind: 'item',
        content: wergenStick,
        spritesheet: 'item',
        quantity: 100,
        owned: 40,
      },
    ]);
  });

  it('resolves an equipment requirement entry', () => {
    vi.mocked(getEntry).mockReturnValue(sword);
    vi.mocked(armoryGet).mockReturnValue([
      { equipmentId: sword.id, id: 'a', infusedItemIds: [] },
    ] as never);
    const requirements: CommissionRequirement[] = [
      { equipmentId: sword.id, quantity: 1 },
    ];

    expect(buildCommissionRequirementEntries(requirements)).toEqual([
      {
        kind: 'equipment',
        content: sword,
        spritesheet: 'equipment',
        quantity: 1,
        owned: 1,
      },
    ]);
  });

  it('resolves a monster-kill requirement entry', () => {
    vi.mocked(getEntry).mockReturnValue(sandWorm);
    const requirements: CommissionRequirement[] = [
      { monsterId: sandWorm.id, quantity: 5, progress: 2 },
    ];

    expect(buildCommissionRequirementEntries(requirements)).toEqual([
      {
        kind: 'monster',
        content: sandWorm,
        spritesheet: 'monster',
        quantity: 5,
        owned: 2,
      },
    ]);
  });
});
