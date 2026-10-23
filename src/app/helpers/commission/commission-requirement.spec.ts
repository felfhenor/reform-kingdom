import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildCommissionRequirementEntries,
  commissionOfferReputationReward,
  commissionRequirementOwnedQuantity,
  commissionRequirementsSatisfied,
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState } from '@helpers/defaults';
import { applyMaterialDelta } from '@helpers/item/materials';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import type {
  CaravanTraderContent,
  CaravanTraderId,
  CommissionOfferContent,
  CommissionOfferId,
  EncounterId,
  CommissionRequirement,
  EquipmentId,
  GameState,
  IsContentItem,
  ItemId,
  MonsterId,
  RecipeContent,
  RecipeId,
  TownId,
} from '@interfaces';
import { buildEquipmentItem, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

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

  describe('with a recipe gate', () => {
    const swordOffer = offer({
      id: 'offer-b' as CommissionOfferId,
      requirements: [{ equipmentId: sword.id, quantityMin: 1, quantityMax: 1 }],
    });
    const slots = [
      { commissionOfferId: offer().id, weight: 1 },
      { commissionOfferId: swordOffer.id, weight: 1 },
    ];
    const recipe = (id: string, result: RecipeContent['result']) =>
      ensureRecipe({ id: id as RecipeId, result, minTradeskillLevel: 50 });
    const swordRecipe = recipe('sword-recipe', { equipmentId: sword.id });
    const stickRecipe = recipe('stick-recipe', {
      itemId: stick.id,
      quantity: 1,
    });
    const recipeDrop = ensureEncounter({
      id: 'forest-ruins' as EncounterId,
      name: 'Forest Ruins',
      completionRewards: [
        ensureDroppedReward({ recipeId: swordRecipe.id }),
        ensureDroppedReward({ recipeId: stickRecipe.id }),
      ],
    });

    const swordOnlyFrom = (...sources: IsContentItem[]) => {
      seedContent([
        stick,
        sword,
        offer(),
        swordOffer,
        swordRecipe,
        recipeDrop,
        ...sources,
      ]);
    };

    beforeEach(() => {
      swordOnlyFrom(
        stickRecipe,
        ensureGathering({
          name: 'Wergen Woods',
          gatherResults: [
            ensureGatherResult({
              chance: 100,
              items: [{ itemId: stick.id, quantity: 1 }],
            }),
          ],
        }),
      );
      seedWorldNodes([{ name: 'Wergen Woods', type: 'GatherNode' }]);
    });

    it('drops an offer needing a crafted-only good until its dropped recipe is found, ignoring gatherables', () => {
      expect(eligibleCommissionOffers(slots)).toEqual([
        { offer: offer(), weight: 1 },
      ]);

      seedGamestate((state) => {
        state.discoveredRecipes[swordRecipe.id] = { foundAt: 1000 };
      });
      expect(eligibleCommissionOffers(slots)).toHaveLength(2);
    });

    it('keeps an offer when any of its recipes is known, regardless of tradeskill level', () => {
      swordOnlyFrom(recipe('ungated-sword-recipe', { equipmentId: sword.id }));

      expect(eligibleCommissionOffers(slots)).toHaveLength(2);
    });

    it.each<[string, Partial<CaravanTraderContent>]>([
      [
        'gold',
        {
          trades: [
            { type: 'sell', value: 10, equipmentId: sword.id, weight: 1 },
          ],
        },
      ],
      ['token', { tokenTrades: [{ tokenCost: 3, equipmentId: sword.id }] }],
    ])('keeps an offer whose good a trader sells for %s', (_, trades) => {
      swordOnlyFrom(
        ensureCaravanTrader({ id: 'alekia' as CaravanTraderId, ...trades }),
      );

      expect(eligibleCommissionOffers(slots)).toHaveLength(2);
    });

    it("ignores a trader buying the good, since that's no source", () => {
      swordOnlyFrom(
        ensureCaravanTrader({
          id: 'alekia' as CaravanTraderId,
          trades: [
            { type: 'buy', value: 10, equipmentId: sword.id, weight: 1 },
          ],
        }),
      );

      expect(eligibleCommissionOffers(slots)).toHaveLength(1);
    });

    it("keeps an offer whose good only a town's shop crafts", () => {
      swordOnlyFrom(
        ensureTown({
          id: townId,
          name: 'Larsia',
          crafting: { uniqueRecipeIds: ['sword-recipe' as RecipeId] },
        }),
      );

      expect(eligibleCommissionOffers(slots)).toHaveLength(2);
    });

    it('never gates a kill requirement', () => {
      const killOffer = offer({
        id: 'offer-c' as CommissionOfferId,
        requirements: [{ monsterId: worm.id, quantityMin: 1, quantityMax: 1 }],
      });
      seedContent([worm, killOffer]);

      expect(
        eligibleCommissionOffers([
          { commissionOfferId: killOffer.id, weight: 1 },
        ]),
      ).toEqual([{ offer: killOffer, weight: 1 }]);
    });
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

  it('rolls within the content range', () => {
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
