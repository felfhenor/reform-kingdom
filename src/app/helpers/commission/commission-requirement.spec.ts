import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildCommissionRequirementEntries,
  commissionOfferReputationReward,
  commissionRequirementOwnedQuantity,
  commissionRequirementsSatisfied,
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { defaultGameState } from '@helpers/defaults';
import { applyMaterialDelta } from '@helpers/item/materials';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionRequirement,
  EquipmentId,
  GameState,
  ItemId,
  MonsterId,
  TownId,
} from '@interfaces';
import { buildEquipmentItem, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const stick = ensureItem({
  id: 'wergen-stick' as ItemId,
  name: 'Wergen Stick',
});
const sword = ensureEquipment({ id: 'sword' as EquipmentId, name: 'Sword' });
const worm = ensureMonster({ id: 'sand-worm' as MonsterId, name: 'Sand Worm' });

function offer(
  overrides: Partial<CommissionOfferContent> = {},
): CommissionOfferContent {
  return ensureCommissionOffer({
    id: 'offer-a' as CommissionOfferId,
    name: 'Bundle of Wergen Sticks',
    requirements: [{ itemId: stick.id, quantityMin: 10, quantityMax: 10 }],
    ...overrides,
  });
}

const sticks: CommissionRequirement = { itemId: stick.id, quantity: 100 };
const swords: CommissionRequirement = { equipmentId: sword.id, quantity: 1 };
const kills = (progress: number): CommissionRequirement => ({
  monsterId: worm.id,
  quantity: 5,
  progress,
});

function seedOwned(stickCount: number, swordCount = 0, reputationTier = 0) {
  seedGamestate((state) => {
    applyMaterialDelta(state, stick.id, stickCount);
    state.armory = Array.from({ length: swordCount }, () =>
      buildEquipmentItem(sword.id),
    );
    state.world.towns[townId] = buildTownNodeState({
      reputation: TOWN_REPUTATION_THRESHOLDS[reputationTier],
    });
  });
}

beforeEach(() => {
  seedContent([stick, sword, worm, offer()]);
});

describe('eligibleCommissionOffers', () => {
  it('pairs each offer still in content with its weight', () => {
    expect(
      eligibleCommissionOffers([
        { commissionOfferId: offer().id, weight: 3 },
        { commissionOfferId: 'gone' as CommissionOfferId, weight: 1 },
      ]),
    ).toEqual([{ offer: offer(), weight: 3 }]);
  });
});

describe('rollCommissionRequirements', () => {
  it('rolls each requirement kind, kills starting with no progress', () => {
    const mixed = offer({
      requirements: [
        { itemId: stick.id, quantityMin: 10, quantityMax: 10 },
        { equipmentId: sword.id, quantityMin: 2, quantityMax: 2 },
        { monsterId: worm.id, quantityMin: 5, quantityMax: 5 },
      ],
    });

    expect(rollCommissionRequirements(mixed)).toEqual([
      { itemId: stick.id, quantity: 10 },
      { equipmentId: sword.id, quantity: 2 },
      { monsterId: worm.id, quantity: 5, progress: 0 },
    ]);
  });

  it('rolls within the authored range', () => {
    const ranged = offer({
      requirements: [{ itemId: stick.id, quantityMin: 10, quantityMax: 20 }],
    });

    for (let i = 0; i < 50; i++) {
      const [{ quantity }] = rollCommissionRequirements(ranged);
      expect(quantity).toBeGreaterThanOrEqual(10);
      expect(quantity).toBeLessThanOrEqual(20);
    }
  });

  it('scales by the town’s reputation tier, only for a town commission', () => {
    const scaled = offer({
      reputationTierMultipliers: [
        { tier: 0, value: 1 },
        { tier: 2, value: 15 },
      ],
    });
    seedOwned(0, 0, 2);

    expect(rollCommissionRequirements(scaled, townId)).toEqual([
      { itemId: stick.id, quantity: 150 },
    ]);
    expect(rollCommissionRequirements(scaled)).toEqual([
      { itemId: stick.id, quantity: 10 },
    ]);
  });
});

describe('commissionOfferReputationReward', () => {
  it('scales the reward by tier, falling back to the base reward at an unscaled tier', () => {
    const scaled = offer({
      townReputationReward: 10,
      reputationTierMultipliers: [{ tier: 1, value: 5 }],
    });

    seedOwned(0, 0, 1);
    expect(commissionOfferReputationReward(scaled, townId)).toBe(50);

    const commitState = defaultGameState();
    commitState.world.towns[townId] = buildTownNodeState({
      reputation: TOWN_REPUTATION_THRESHOLDS[0],
    });
    expect(commissionOfferReputationReward(scaled, townId, commitState)).toBe(
      10,
    );

    seedOwned(0, 0, 0);
    expect(commissionOfferReputationReward(scaled, townId)).toBe(10);
    expect(
      commissionOfferReputationReward(
        offer({ townReputationReward: 10 }),
        townId,
      ),
    ).toBe(10);
  });
});

describe('owning what a commission asks for', () => {
  it('counts stock, armory pieces and kill progress against each requirement', () => {
    seedOwned(40, 2);

    expect(commissionRequirementOwnedQuantity(sticks)).toBe(40);
    expect(commissionRequirementOwnedQuantity(swords)).toBe(2);
    expect(commissionRequirementOwnedQuantity(kills(3))).toBe(3);
  });

  it('reads an explicit commit-time state over the live one', () => {
    seedOwned(0);
    const commitState: GameState = defaultGameState();
    applyMaterialDelta(commitState, stick.id, 12);
    commitState.armory = [buildEquipmentItem(sword.id)];

    expect(commissionRequirementOwnedQuantity(sticks, commitState)).toBe(12);
    expect(commissionRequirementOwnedQuantity(swords, commitState)).toBe(1);
    expect(commissionRequirementsSatisfied([swords], commitState)).toBe(true);
    expect(commissionRequirementsSatisfied([swords])).toBe(false);
  });

  it('is satisfied only when every requirement is fully met', () => {
    seedOwned(100, 1);
    expect(commissionRequirementsSatisfied([sticks, swords, kills(5)])).toBe(
      true,
    );

    seedOwned(99, 1);
    expect(commissionRequirementsSatisfied([sticks, swords])).toBe(false);
    expect(commissionRequirementsSatisfied([kills(4)])).toBe(false);
  });

  it('lists each requirement with its content, sprite sheet and what is owned', () => {
    seedOwned(40, 1);

    expect(
      buildCommissionRequirementEntries([sticks, swords, kills(2)]),
    ).toEqual([
      {
        kind: 'item',
        content: stick,
        spritesheet: 'item',
        quantity: 100,
        owned: 40,
      },
      {
        kind: 'equipment',
        content: sword,
        spritesheet: 'equipment',
        quantity: 1,
        owned: 1,
      },
      {
        kind: 'monster',
        content: worm,
        spritesheet: 'monster',
        quantity: 5,
        owned: 2,
      },
    ]);
  });
});
