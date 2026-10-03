import { beforeEach, describe, expect, it } from 'vitest';

import { LOOT_FILTER_AUTO_SELL_PERCENT } from '@helpers/config';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { defaultLootFilterSettings, defaultStats } from '@helpers/defaults';
import { getGoldQuantity } from '@helpers/item/materials';
import {
  equipmentSellValue,
  isEquipmentDiscovered,
} from '@helpers/kingdom/armory';
import {
  armoryCapForState,
  armoryOverflowCapForState,
} from '@helpers/kingdom/armory-global-effects';
import {
  armoryAddLootDrop,
  equipmentPassesLootFilter,
} from '@helpers/kingdom/loot-filter';
import { armoryState, gamestate } from '@helpers/state-game';
import type {
  EquipmentId,
  GameState,
  ItemId,
  LootDropOutcome,
  LootFilterSettings,
} from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  name: 'Sword',
  type: 'Sword',
  rarity: 'Common',
  levelRequirement: 5,
  baseStats: { ...defaultStats(), Strength: 10 },
});

function filtersWith(
  edit: (filters: LootFilterSettings) => void,
): LootFilterSettings {
  const filters = defaultLootFilterSettings();
  edit(filters);
  return filters;
}

const rejectSwords = (state: GameState) => {
  state.lootFilters.keepEquipmentTypes.Sword = false;
};

const fillArmory = (state: GameState) => {
  state.armory = Array.from({ length: armoryOverflowCapForState(state) }, () =>
    buildEquipmentItem(sword.id),
  );
};

function drop(
  edit: (state: GameState) => void = () => undefined,
  equipmentId = sword.id,
): LootDropOutcome {
  seedGamestate(edit);
  return inTick(() => armoryAddLootDrop(equipmentId));
}

beforeEach(() => {
  seedContent([sword, ensureItem({ id: 'gold' as ItemId, name: 'Gold Coin' })]);
});

describe('equipmentPassesLootFilter', () => {
  it('keeps only drops of a kept rarity and type at or above the minimum level', () => {
    expect(equipmentPassesLootFilter(sword, defaultLootFilterSettings())).toBe(
      true,
    );
    expect(
      equipmentPassesLootFilter(
        sword,
        filtersWith((f) => (f.minimumItemLevel = sword.levelRequirement)),
      ),
    ).toBe(true);

    [
      filtersWith((f) => (f.keepRarities.Common = false)),
      filtersWith((f) => (f.minimumItemLevel = sword.levelRequirement + 1)),
      filtersWith((f) => (f.keepEquipmentTypes.Sword = false)),
    ].forEach((filters) => {
      expect(equipmentPassesLootFilter(sword, filters)).toBe(false);
    });
  });
});

describe('armoryAddLootDrop', () => {
  it('keeps a drop the filter accepts in the armory', () => {
    expect(drop()).toEqual({ kind: 'Kept', content: sword });

    expect(armoryState().map((item) => item.equipmentId)).toEqual([sword.id]);
    expect(isEquipmentDiscovered(sword.id)).toBe(true);
    expect(getGoldQuantity()).toBe(0);
  });

  it('sells a rejected drop on the spot, even with the armory full, still discovering it', () => {
    const goldEarned = Math.round(
      equipmentSellValue({
        item: buildEquipmentItem(sword.id),
        content: sword,
      }) * LOOT_FILTER_AUTO_SELL_PERCENT,
    );

    const outcome = drop((state) => {
      rejectSwords(state);
      fillArmory(state);
    });

    expect(goldEarned).toBeGreaterThan(0);
    expect(outcome).toEqual({ kind: 'AutoSold', content: sword, goldEarned });
    expect(getGoldQuantity()).toBe(goldEarned);
    expect(armoryState()).toHaveLength(armoryOverflowCapForState(gamestate()));
    expect(isEquipmentDiscovered(sword.id)).toBe(true);
  });

  it('lets drops overflow the normal armory cap', () => {
    const atCap = (state: GameState) => {
      state.armory = Array.from({ length: armoryCapForState(state) }, () =>
        buildEquipmentItem(sword.id),
      );
    };

    expect(armoryCapForState(gamestate())).toBeLessThan(
      armoryOverflowCapForState(gamestate()),
    );
    expect(drop(atCap).kind).toBe('Kept');
    expect(drop(atCap, 'gone' as EquipmentId).kind).toBe('UnknownContent');
  });

  it('loses a kept drop once the armory is past its loot overflow', () => {
    expect(drop(fillArmory)).toEqual({ kind: 'NoRoom' });

    expect(armoryState()).toHaveLength(armoryOverflowCapForState(gamestate()));
  });

  it('still stores a drop whose content is gone, unfiltered', () => {
    const gone = 'gone' as EquipmentId;

    expect(drop(rejectSwords, gone)).toEqual({ kind: 'UnknownContent' });
    expect(armoryState().map((item) => item.equipmentId)).toEqual([gone]);

    expect(drop(fillArmory, gone)).toEqual({ kind: 'NoRoom' });
  });
});
