import { beforeEach, describe, expect, it } from 'vitest';

import {
  caravanIsTradeSoldOut,
  caravanTradeMaxQuantity,
  caravanTradeOwnedQuantity,
  caravanTradePrice,
  caravanTradeRemaining,
} from '@helpers/caravan/caravan-trade-quantity';
import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureCaravan } from '@helpers/content/ensure-caravan';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  AffixEffect,
  AffixId,
  CaravanContent,
  CaravanId,
  CaravanTrade,
  CollectibleId,
  EquipmentId,
  GameState,
  ItemId,
  RecipeId,
} from '@interfaces';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const goldCoin = ensureItem({ id: 'gold-coin' as ItemId, name: 'Gold Coin' });
const ore = 'copper-ore' as ItemId;
const relic = 'relic' as CollectibleId;
const cloakRecipe = 'cloak-recipe' as RecipeId;
const sword = ensureEquipment({ id: 'sword' as EquipmentId, name: 'Sword' });

const caravan = (sell = 25, buy = -15): CaravanContent =>
  ensureCaravan({
    id: 'duchy' as CaravanId,
    markupPercentages: { sell, buy },
  });

const trade = (overrides: Partial<CaravanTrade>): CaravanTrade => ({
  type: 'sell',
  value: 100,
  weight: 1,
  ...overrides,
});

beforeEach(() => {
  seedContent([goldCoin, sword]);
});

describe('caravanTradePrice', () => {
  it('marks sells up and buys down by the caravan’s markups, never below 1 gold', () => {
    expect(caravanTradePrice(caravan(), trade({ type: 'sell' }))).toBe(125);
    expect(caravanTradePrice(caravan(), trade({ type: 'buy' }))).toBe(85);
    expect(caravanTradePrice(caravan(0, -100), trade({ type: 'buy' }))).toBe(1);
  });

  it('applies the party’s caravan affixes for the trade’s direction only', () => {
    const wearing = (...effects: AffixEffect[]) => {
      const affix = ensureAffix({ id: 'trader' as AffixId, effects });
      seedContent([goldCoin, sword, affix]);
      const hero = buildCharacter();
      hero.equipment.Weapon = buildEquipmentItem(sword.id, {
        affixIds: [affix.id],
      });
      seedGamestate((state) => (state.world.party = [hero]));
    };

    wearing(
      { kind: 'CaravanBuyDiscount', value: 20 },
      { kind: 'CaravanSellBonus', value: 10 },
    );

    expect(caravanTradePrice(caravan(0, 0), trade({ type: 'sell' }))).toBe(80);
    expect(caravanTradePrice(caravan(0, 0), trade({ type: 'buy' }))).toBe(110);
  });
});

describe('caravanTradeRemaining', () => {
  it('is the limit less what was traded, floored at 0, or undefined when unlimited', () => {
    expect(caravanTradeRemaining(trade({}), {}, 0)).toBeUndefined();
    expect(caravanTradeRemaining(trade({ limit: 5 }), { 0: 2 }, 0)).toBe(3);
    expect(caravanTradeRemaining(trade({ limit: 5 }), { 0: 9 }, 0)).toBe(0);
  });
});

describe('caravanIsTradeSoldOut', () => {
  it('sells out once the limit is used up, never when unlimited', () => {
    expect(caravanIsTradeSoldOut(trade({}), { 0: 99 }, 0)).toBe(false);
    expect(caravanIsTradeSoldOut(trade({ limit: 2 }), { 0: 1 }, 0)).toBe(false);
    expect(caravanIsTradeSoldOut(trade({ limit: 2 }), { 0: 2 }, 0)).toBe(true);
  });

  it('sells out a collectible or recipe the player already has, even unlimited', () => {
    const relicTrade = trade({ collectibleId: relic });
    const recipeTrade = trade({ recipeId: cloakRecipe });
    expect(caravanIsTradeSoldOut(relicTrade, {}, 0)).toBe(false);
    expect(caravanIsTradeSoldOut(recipeTrade, {}, 0)).toBe(false);

    seedGamestate((state) => {
      applyCollectibleGrant(state, relic, 1);
      state.discoveredRecipes[cloakRecipe] = { foundAt: 1 };
    });
    expect(caravanIsTradeSoldOut(relicTrade, {}, 0)).toBe(true);
    expect(caravanIsTradeSoldOut(recipeTrade, {}, 0)).toBe(true);
  });
});

describe('caravanTradeOwnedQuantity', () => {
  function owning(state: GameState): GameState {
    applyMaterialDelta(state, ore, 7);
    applyCollectibleGrant(state, relic, 3);
    state.armory = [
      buildEquipmentItem(sword.id),
      buildEquipmentItem('other' as EquipmentId),
      buildEquipmentItem(sword.id),
    ];
    state.discoveredRecipes[cloakRecipe] = { foundAt: 1 };
    return state;
  }

  const ownedOf = (state?: GameState) => [
    caravanTradeOwnedQuantity(trade({ itemId: ore }), state),
    caravanTradeOwnedQuantity(trade({ equipmentId: sword.id }), state),
    caravanTradeOwnedQuantity(trade({ collectibleId: relic }), state),
    caravanTradeOwnedQuantity(trade({ recipeId: cloakRecipe }), state),
    caravanTradeOwnedQuantity(trade({}), state),
  ];

  it('counts what the player holds of the trade’s target', () => {
    seedGamestate(owning);

    expect(ownedOf()).toEqual([7, 2, 3, 1, 0]);
  });

  it('counts from a given state instead of live state', () => {
    const given = seedGamestate(owning);
    seedGamestate();

    expect(ownedOf()).toEqual([0, 0, 0, 0, 0]);
    expect(ownedOf(given)).toEqual([7, 2, 3, 1, 0]);
  });
});

describe('caravanTradeMaxQuantity', () => {
  const withGold = (gold: number, edit?: (state: GameState) => void) =>
    seedGamestate((state) => {
      applyMaterialDelta(state, goldCoin.id, gold);
      edit?.(state);
    });

  it('caps a purchase by the gold on hand and any remaining stock', () => {
    const price = caravanTradePrice(caravan(), trade({}));

    withGold(price * 2 + 1);
    expect(caravanTradeMaxQuantity(caravan(), trade({}), {}, 0)).toBe(2);
    expect(
      caravanTradeMaxQuantity(caravan(), trade({ limit: 3 }), { 0: 2 }, 0),
    ).toBe(1);

    expect(
      caravanTradeMaxQuantity(caravan(), trade({ limit: 10 }), {}, 0),
    ).toBe(2);

    withGold(price - 1);
    expect(caravanTradeMaxQuantity(caravan(), trade({}), {}, 0)).toBe(0);
  });

  it('caps a sale by what the player owns and any remaining stock', () => {
    withGold(0, (state) => applyMaterialDelta(state, ore, 5));
    const selling = (limit?: number) =>
      trade({ type: 'buy', itemId: ore, limit });

    expect(caravanTradeMaxQuantity(caravan(), selling(), {}, 0)).toBe(5);
    expect(caravanTradeMaxQuantity(caravan(), selling(10), {}, 0)).toBe(5);
    expect(caravanTradeMaxQuantity(caravan(), selling(10), { 0: 8 }, 0)).toBe(
      2,
    );
  });

  it('allows one of a collectible or recipe the player lacks, none once had', () => {
    const relicTrade = trade({ collectibleId: relic, limit: 5 });
    const recipeTrade = trade({ recipeId: cloakRecipe, limit: 5 });

    withGold(0);
    expect(caravanTradeMaxQuantity(caravan(), relicTrade, {}, 0)).toBe(1);
    expect(caravanTradeMaxQuantity(caravan(), recipeTrade, {}, 0)).toBe(1);

    withGold(0, (state) => {
      applyCollectibleGrant(state, relic, 1);
      state.discoveredRecipes[cloakRecipe] = { foundAt: 1 };
    });
    expect(caravanTradeMaxQuantity(caravan(), relicTrade, {}, 0)).toBe(0);
    expect(caravanTradeMaxQuantity(caravan(), recipeTrade, {}, 0)).toBe(0);
  });

  it('checks a given state instead of live state', () => {
    const price = caravanTradePrice(caravan(), trade({}));
    const given = withGold(price * 3, (state) => {
      applyCollectibleGrant(state, relic, 1);
      applyMaterialDelta(state, ore, 4);
      state.discoveredRecipes[cloakRecipe] = { foundAt: 1 };
    });
    withGold(0);

    expect(caravanTradeMaxQuantity(caravan(), trade({}), {}, 0, given)).toBe(3);
    expect(
      caravanTradeMaxQuantity(
        caravan(),
        trade({ collectibleId: relic }),
        {},
        0,
        given,
      ),
    ).toBe(0);
    expect(
      caravanTradeMaxQuantity(
        caravan(),
        trade({ type: 'buy', itemId: ore }),
        {},
        0,
        given,
      ),
    ).toBe(4);
    expect(
      caravanTradeMaxQuantity(
        caravan(),
        trade({ recipeId: cloakRecipe }),
        {},
        0,
        given,
      ),
    ).toBe(0);
  });
});
