import type {
  AffixId,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ExchangeNodeId,
  GameState,
  IsContentItem,
  ItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/affix', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  rollAffixIds: vi.fn(),
}));

import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureExchangeNode } from '@helpers/content/ensure-exchangenode';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { defaultGameState } from '@helpers/defaults';
import {
  applyEquipmentExchange,
  applyItemExchange,
  exchangeArmoryCandidates,
  exchangedEquipmentItem,
  exchangeHasInput,
} from '@helpers/exchange/exchange';
import { rollAffixIds } from '@helpers/item/affix';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

describe('exchange', () => {
  const water = ensureItem({ id: 'water' as ItemId, name: 'Purity Water' });
  const horn = ensureItem({ id: 'horn' as ItemId, name: 'Demon Horn' });
  const purifiedHorn = ensureItem({
    id: 'purified-horn' as ItemId,
    name: 'Purified Horn',
  });
  const gem = ensureItem({ id: 'gem' as ItemId, name: 'Gem' });
  const demonSword = ensureEquipment({
    id: 'demon-sword' as EquipmentId,
    name: 'Demonic Sword',
    rarity: 'Rare',
    slots: 2,
  });
  const purifiedSword = ensureEquipment({
    id: 'purified-sword' as EquipmentId,
    name: 'Purified Epee',
    rarity: 'Rare',
    slots: 1,
  });
  const strengthAffix = ensureAffix({
    id: 'strong' as AffixId,
    name: 'of Strength',
    family: 'Strength',
    effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
  });
  const well = ensureExchangeNode({
    id: 'well' as ExchangeNodeId,
    name: 'Purification Well',
    exchanges: [
      {
        kind: 'Equipment',
        inputEquipmentId: demonSword.id,
        outputEquipmentId: purifiedSword.id,
        costs: [{ itemId: water.id, required: 10 }],
      },
      {
        kind: 'Item',
        input: { itemId: horn.id, required: 5 },
        output: { itemId: purifiedHorn.id, quantity: 1 },
        costs: [{ itemId: water.id, required: 3 }],
      },
    ],
  });
  const [swordExchange, hornExchange] = well.exchanges;

  const content: IsContentItem[] = [
    water,
    horn,
    purifiedHorn,
    gem,
    demonSword,
    purifiedSword,
    strengthAffix,
    well,
  ];

  let itemCounter = 0;
  function swordItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
    return buildEquipmentItem(demonSword.id, {
      id: `item-${itemCounter++}` as EquipmentItemId,
      affixIds: [strengthAffix.id],
      ...overrides,
    });
  }

  function stateWith(
    armory: EquipmentItem[],
    materials: Record<string, number> = {},
  ): GameState {
    const state = defaultGameState();
    state.armory = armory;
    Object.entries(materials).forEach(([itemId, quantity]) => {
      state.materials[itemId as ItemId] = { quantity, foundAt: 1 };
    });
    return state;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    seedContent(content);
  });

  describe('exchangedEquipmentItem', () => {
    it('swaps the base while keeping identity, affixes and infusions', () => {
      const item = swordItem({ infusedItemIds: [gem.id] });

      const swapped = exchangedEquipmentItem(item, purifiedSword.id);

      expect(swapped).toEqual({
        ...item,
        equipmentId: purifiedSword.id,
      });
      expect(rollAffixIds).not.toHaveBeenCalled();
    });

    it('drops gems beyond the new base slot count', () => {
      const item = swordItem({ infusedItemIds: [gem.id, gem.id] });

      expect(
        exchangedEquipmentItem(item, purifiedSword.id).infusedItemIds,
      ).toEqual([gem.id]);
    });
  });

  describe('exchangeHasInput', () => {
    it('only counts unequipped armory gear', () => {
      const item = swordItem();

      expect(exchangeHasInput(stateWith([]), swordExchange)).toBe(false);
      expect(exchangeHasInput(stateWith([item]), swordExchange)).toBe(true);
      if (swordExchange.kind !== 'Equipment') throw new Error('bad fixture');
      expect(
        exchangeArmoryCandidates(stateWith([item]), swordExchange),
      ).toEqual([item]);
    });

    it('requires the full item input quantity', () => {
      expect(
        exchangeHasInput(stateWith([], { [horn.id]: 4 }), hornExchange),
      ).toBe(false);
      expect(
        exchangeHasInput(stateWith([], { [horn.id]: 5 }), hornExchange),
      ).toBe(true);
    });
  });

  describe('applyEquipmentExchange', () => {
    it('swaps the armory item in place, spends costs and marks discovery', () => {
      const item = swordItem({ infusedItemIds: [gem.id] });
      const state = stateWith([item], { [water.id]: 10 });

      expect(applyEquipmentExchange(state, well.name, 0, item.id)).toBe('ok');
      expect(state.armory[0]).toEqual({
        ...item,
        equipmentId: purifiedSword.id,
      });
      expect(state.materials[water.id]?.quantity ?? 0).toBe(0);
      expect(state.discoveredEquipment[purifiedSword.id]).toBeDefined();
      expect(rollAffixIds).not.toHaveBeenCalled();
    });

    it('rejects gear that is not in the armory', () => {
      const state = stateWith([], { [water.id]: 10 });

      expect(applyEquipmentExchange(state, well.name, 0, swordItem().id)).toBe(
        'missing',
      );
    });

    it('rejects an unaffordable exchange without changing anything', () => {
      const item = swordItem();
      const state = stateWith([item], { [water.id]: 9 });

      expect(applyEquipmentExchange(state, well.name, 0, item.id)).toBe(
        'unaffordable',
      );
      expect(state.armory[0]).toEqual(item);
      expect(state.materials[water.id]?.quantity).toBe(9);
    });

    it('rejects an item that does not match the exchange input', () => {
      const item = swordItem({ equipmentId: purifiedSword.id });
      const state = stateWith([item], { [water.id]: 10 });

      expect(applyEquipmentExchange(state, well.name, 0, item.id)).toBe(
        'invalid',
      );
    });

    it('rejects an exchange index of the wrong kind', () => {
      const item = swordItem();
      const state = stateWith([item], { [water.id]: 10 });

      expect(applyEquipmentExchange(state, well.name, 1, item.id)).toBe(
        'invalid',
      );
    });
  });

  describe('applyItemExchange', () => {
    it('consumes the input and costs, then grants the output', () => {
      const state = stateWith([], { [horn.id]: 6, [water.id]: 3 });

      expect(applyItemExchange(state, well.name, 1)).toBe('ok');
      expect(state.materials[horn.id]?.quantity).toBe(1);
      expect(state.materials[water.id]?.quantity ?? 0).toBe(0);
      expect(state.materials[purifiedHorn.id]?.quantity).toBe(1);
      expect(state.discoveredMaterials[purifiedHorn.id]).toBeDefined();
    });

    it('rejects when the input is missing', () => {
      const state = stateWith([], { [horn.id]: 4, [water.id]: 3 });

      expect(applyItemExchange(state, well.name, 1)).toBe('missing');
    });

    it('rejects when costs are unaffordable', () => {
      const state = stateWith([], { [horn.id]: 5, [water.id]: 2 });

      expect(applyItemExchange(state, well.name, 1)).toBe('unaffordable');
      expect(state.materials[horn.id]?.quantity).toBe(5);
    });
  });
});
