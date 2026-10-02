import { beforeEach, describe, expect, it } from 'vitest';

import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { defaultGameState, defaultStats } from '@helpers/defaults';
import {
  addArmoryItems,
  armoryAdd,
  armoryAddWithAffixes,
  armoryCap,
  armoryHasRoom,
  armoryHasRoomFor,
  armoryHasRoomForState,
  armoryOverflowCap,
  equipmentSellValue,
  getArmoryEntries,
  isEquipmentDiscovered,
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
  RARITY_SELL_MULTIPLIER,
} from '@helpers/kingdom/armory';
import { armoryState, gamestate } from '@helpers/state-game';
import type {
  AffixId,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  GlobalEffectId,
  ItemId,
} from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const swordId = 'sword' as EquipmentId;
const shieldId = 'shield' as EquipmentId;
const staleId = 'stale-gear' as EquipmentId;
const crystalId = 'crystal' as ItemId;
const sellAffixId = 'affix-sell' as AffixId;
const overburdenedId = 'overburdened' as GlobalEffectId;

const sword = ensureEquipment({ id: swordId, name: 'Sword' });
const shield = ensureEquipment({
  id: shieldId,
  name: 'Shield',
  rarity: 'Rare',
});

beforeEach(() => {
  seedContent([
    sword,
    shield,
    ensureItem({
      id: crystalId,
      name: 'Crystal',
      infusionStats: { ...defaultStats(), Strength: 3 },
    }),
    ensureAffix({
      id: sellAffixId,
      name: 'Of Value',
      effects: [{ kind: 'SellValue', value: 250 }],
    }),
    ensureGlobalEffect({ id: overburdenedId, name: 'Overburdened' }),
  ]);
});

function items(equipmentId: EquipmentId, count: number): EquipmentItem[] {
  return Array.from({ length: count }, () => buildEquipmentItem(equipmentId));
}

function stateWithArmory(count: number, armorySizeBoost = 0): GameState {
  const state = defaultGameState();
  state.armory = items(shieldId, count);
  state.globalEffectSums.armorySizeBoost = armorySizeBoost;
  return state;
}

describe('armory caps', () => {
  it('raises both caps by any active armory size boost', () => {
    seedGamestate();
    const [cap, overflowCap] = [armoryCap(), armoryOverflowCap()];
    seedGamestate((state) => (state.globalEffectSums.armorySizeBoost = 15));

    expect(armoryCap()).toBe(cap + 15);
    expect(armoryOverflowCap()).toBeGreaterThan(overflowCap);
  });

  it('lets drops overshoot the strict cap', () => {
    seedGamestate();

    expect(armoryOverflowCap()).toBeGreaterThan(armoryCap());
  });
});

describe('armoryHasRoomFor / armoryHasRoom', () => {
  beforeEach(() => seedGamestate());

  it('has room under the strict cap but not at it', () => {
    expect(armoryHasRoomFor(armoryCap() - 1)).toBe(true);
    expect(armoryHasRoomFor(armoryCap())).toBe(false);
  });

  it('allows overflow up to the overflow cap when requested', () => {
    expect(armoryHasRoomFor(armoryCap(), 1, true)).toBe(true);
    expect(armoryHasRoomFor(armoryOverflowCap() - 1, 1, true)).toBe(true);
    expect(armoryHasRoomFor(armoryOverflowCap(), 1, true)).toBe(false);
  });

  it('accounts for a multi-item quantity', () => {
    const count = armoryCap() - 5;

    expect(armoryHasRoomFor(count, 5)).toBe(true);
    expect(armoryHasRoomFor(count, 6)).toBe(false);
  });

  it('reads the live armory length', () => {
    seedGamestate((state) => (state.armory = items(shieldId, armoryCap())));

    expect(armoryHasRoom()).toBe(false);
    expect(armoryHasRoom(1, true)).toBe(true);
  });
});

describe('armoryHasRoomForState', () => {
  beforeEach(() => seedGamestate());

  it('uses the passed state cap, including a boost applied earlier in the same callback', () => {
    expect(armoryHasRoomForState(stateWithArmory(armoryCap()), 1)).toBe(false);
    expect(armoryHasRoomForState(stateWithArmory(armoryCap(), 5), 1)).toBe(
      true,
    );
  });

  it('allows overflow up to the state overflow cap when requested', () => {
    const overflowCap = armoryOverflowCap();

    expect(
      armoryHasRoomForState(stateWithArmory(overflowCap - 1), 1, true),
    ).toBe(true);
    expect(armoryHasRoomForState(stateWithArmory(overflowCap), 1, true)).toBe(
      false,
    );
  });
});

describe('armoryAdd', () => {
  it('appends distinct new instances and marks the equipment discovered', () => {
    seedGamestate((state) => (state.armory = items(shieldId, 1)));

    inTick(() => armoryAdd(swordId, 3));

    const added = armoryState().filter((item) => item.equipmentId === swordId);
    expect(armoryState()).toHaveLength(4);
    expect(new Set(added.map((item) => item.id)).size).toBe(3);
    expect(isEquipmentDiscovered(swordId)).toBe(true);
  });

  it('does nothing for a zero or negative quantity', () => {
    const before = seedGamestate();

    inTick(() => {
      armoryAdd(swordId, 0);
      armoryAdd(swordId, -1);
    });

    expect(gamestate()).toBe(before);
  });

  it('preserves the original discovery timestamp on repeat finds', () => {
    seedGamestate((state) => {
      state.discoveredEquipment[swordId] = { foundAt: 1000 };
    });

    inTick(() => armoryAdd(swordId));

    expect(gamestate().discoveredEquipment[swordId]).toEqual({ foundAt: 1000 });
  });

  it('returns how many were admitted once the strict cap is reached', () => {
    seedGamestate((state) => (state.armory = items(shieldId, armoryCap())));

    expect(inTick(() => armoryAdd(swordId, 3))).toBe(0);
    expect(armoryState()).toHaveLength(armoryCap());
  });
});

describe('addArmoryItems - cap clamping', () => {
  beforeEach(() => seedGamestate());

  it('admits only as many as fit under the strict cap', () => {
    const state = stateWithArmory(armoryCap() - 2);

    const admitted = addArmoryItems(state, swordId, items(swordId, 5));

    expect(admitted).toHaveLength(2);
    expect(state.armory).toHaveLength(armoryCap());
  });

  it('admits up to the overflow cap when allowOverflow is set', () => {
    const state = stateWithArmory(armoryOverflowCap() - 2);

    const admitted = addArmoryItems(state, swordId, items(swordId, 5), true);

    expect(admitted).toHaveLength(2);
    expect(state.armory).toHaveLength(armoryOverflowCap());
  });

  it('ignores the cap entirely when bypassCap is set', () => {
    const state = stateWithArmory(armoryOverflowCap());

    const admitted = addArmoryItems(
      state,
      swordId,
      items(swordId, 5),
      false,
      true,
    );

    expect(admitted).toHaveLength(5);
  });

  it('does not mark discovery when nothing was admitted', () => {
    const state = stateWithArmory(armoryCap());

    addArmoryItems(state, swordId, items(swordId, 1));

    expect(state.discoveredEquipment[swordId]).toBeUndefined();
  });

  it('syncs the armory-fullness global effect when an add reaches the cap', () => {
    const state = stateWithArmory(armoryCap() - 1);

    addArmoryItems(state, swordId, items(swordId, 1));

    expect(state.globalEffects.map((effect) => effect.id)).toEqual([
      overburdenedId,
    ]);
  });
});

describe('armoryAddWithAffixes', () => {
  it('appends one item carrying exactly the given affixes, even past the cap', () => {
    const affixIds = ['affix-str', 'affix-vit'] as AffixId[];
    seedGamestate((state) => (state.armory = items(shieldId, armoryCap())));

    inTick(() => armoryAddWithAffixes(swordId, affixIds));

    expect(armoryState().at(-1)).toMatchObject({
      equipmentId: swordId,
      affixIds,
    });
    expect(isEquipmentDiscovered(swordId)).toBe(true);
  });
});

describe('isEquipmentDiscovered', () => {
  it('stays true after the equipment leaves the armory', () => {
    seedGamestate((state) => {
      state.discoveredEquipment[swordId] = { foundAt: 1000 };
    });

    expect(isEquipmentDiscovered(swordId)).toBe(true);
    expect(isEquipmentDiscovered(shieldId)).toBe(false);
  });
});

describe('pruneInvalidDiscoveredEquipment', () => {
  it('drops only the entries that no longer resolve to content', () => {
    expect(
      pruneInvalidDiscoveredEquipment({
        [swordId]: { foundAt: 1000 },
        [staleId]: { foundAt: 1000 },
      }),
    ).toEqual({ [swordId]: { foundAt: 1000 } });
  });
});

describe('pruneInvalidArmoryItems', () => {
  it('drops only the items that no longer resolve to content', () => {
    const kept = buildEquipmentItem(swordId);

    expect(
      pruneInvalidArmoryItems([kept, buildEquipmentItem(staleId)]),
    ).toEqual([kept]);
  });
});

describe('getArmoryEntries', () => {
  it('returns one entry per owned item, without merging duplicates, sorted by rarity then name', () => {
    const swordItem1 = buildEquipmentItem(swordId, {
      id: 'sword-1' as EquipmentItemId,
    });
    const shieldItem = buildEquipmentItem(shieldId);
    const swordItem2 = buildEquipmentItem(swordId, {
      id: 'sword-2' as EquipmentItemId,
    });
    seedGamestate((state) => {
      state.armory = [swordItem1, shieldItem, swordItem2, ...items(staleId, 1)];
    });

    expect(getArmoryEntries()).toEqual([
      { item: shieldItem, content: shield },
      { item: swordItem1, content: sword },
      { item: swordItem2, content: sword },
    ]);
  });
});

describe('equipmentSellValue', () => {
  function sellValue(
    content: Partial<EquipmentContent>,
    item: Partial<EquipmentItem> = {},
  ): number {
    return equipmentSellValue({
      item: buildEquipmentItem(swordId, item),
      content: ensureEquipment({ ...sword, ...content }),
    });
  }

  const strongSword = {
    baseStats: { ...defaultStats(), Strength: 5 },
    levelRequirement: 2,
  };

  it('scales the stat and level value by rarity', () => {
    const common = sellValue({ ...strongSword, rarity: 'Common' });
    const rare = sellValue({ ...strongSword, rarity: 'Rare' });

    expect(common).toBeGreaterThan(1);
    expect(rare / common).toBeCloseTo(
      RARITY_SELL_MULTIPLIER.Rare / RARITY_SELL_MULTIPLIER.Common,
      1,
    );
  });

  it('values infused stats the same as base stats', () => {
    const infused = sellValue(strongSword, { infusedItemIds: [crystalId] });
    const equivalentBase = sellValue({
      ...strongSword,
      baseStats: { ...defaultStats(), Strength: 8 },
    });

    expect(infused).toBe(equivalentBase);
  });

  it('adds a SellValue affix as a flat amount, unscaled by rarity', () => {
    const rare = { ...strongSword, rarity: 'Rare' as const };

    expect(sellValue(rare, { affixIds: [sellAffixId] }) - sellValue(rare)).toBe(
      250,
    );
  });

  it('never returns less than 1 gold', () => {
    expect(sellValue({ baseStats: defaultStats(), levelRequirement: 0 })).toBe(
      1,
    );
  });
});
