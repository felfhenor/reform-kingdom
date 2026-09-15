import { defaultLootFilterSettings, defaultStats } from '@helpers/defaults';
import type {
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  LootFilterSettings,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/equipment', () => ({
  newEquipmentItem: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  gainGold: vi.fn(),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  addArmoryItems: vi.fn(),
  equipmentSellValue: vi.fn(),
  markEquipmentDiscovered: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { newEquipmentItem } from '@helpers/item/equipment';
import { gainGold } from '@helpers/item/materials';
import {
  addArmoryItems,
  equipmentSellValue,
  markEquipmentDiscovered,
} from '@helpers/kingdom/armory';
import {
  armoryAddLootDrop,
  equipmentPassesLootFilter,
} from '@helpers/kingdom/loot-filter';
import { updateGamestate } from '@helpers/state-game';

const SWORD_ID = 'sword' as EquipmentId;

const sword: EquipmentContent = {
  id: SWORD_ID,
  name: 'Sword',
  __type: 'equipment',
  description: 'A sharp blade.',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 5,
  baseStats: defaultStats(),
  type: 'Sword',
  slots: 1,
  grantedSkillIds: [],
};

function keepAll(): LootFilterSettings {
  return defaultLootFilterSettings();
}

function buildArmoryItem(): EquipmentItem {
  return {
    id: 'sword-item' as EquipmentItemId,
    equipmentId: SWORD_ID,
    infusedItemIds: [],
    affixIds: [],
  };
}

describe('equipmentPassesLootFilter', () => {
  it('passes when rarity, level, and type are all kept', () => {
    expect(equipmentPassesLootFilter(sword, keepAll())).toBe(true);
  });

  it('fails when the rarity is unselected', () => {
    const filters = keepAll();
    filters.keepRarities.Common = false;

    expect(equipmentPassesLootFilter(sword, filters)).toBe(false);
  });

  it('fails when the item level is below the minimum', () => {
    const filters = keepAll();
    filters.minimumItemLevel = 10;

    expect(equipmentPassesLootFilter(sword, filters)).toBe(false);
  });

  it('fails when the equipment type is unselected', () => {
    const filters = keepAll();
    filters.keepEquipmentTypes.Sword = false;

    expect(equipmentPassesLootFilter(sword, filters)).toBe(false);
  });
});

describe('armoryAddLootDrop', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(newEquipmentItem).mockReturnValue(buildArmoryItem());
  });

  function runWith(state: GameState): void {
    vi.mocked(updateGamestate).mockImplementation(async (fn) =>
      fn(state as GameState),
    );
  }

  it('reports NoRoom without touching gold when a kept drop has no space', () => {
    vi.mocked(getEntry).mockReturnValue(sword);
    vi.mocked(addArmoryItems).mockReturnValue([]);
    const state = {
      armory: [],
      lootFilters: keepAll(),
    } as unknown as GameState;
    runWith(state);

    const outcome = armoryAddLootDrop(SWORD_ID);

    expect(outcome).toEqual({ kind: 'NoRoom' });
    expect(gainGold).not.toHaveBeenCalled();
  });

  it('reports UnknownContent and leaves the item in the armory when content cannot resolve', () => {
    const item = buildArmoryItem();
    vi.mocked(addArmoryItems).mockImplementation((state, _id, items) => {
      (state as GameState).armory = [...state.armory, ...items];
      return items;
    });
    vi.mocked(getEntry).mockReturnValue(undefined);
    const state = {
      armory: [],
      lootFilters: keepAll(),
    } as unknown as GameState;
    runWith(state);

    const outcome = armoryAddLootDrop(SWORD_ID);

    expect(outcome).toEqual({ kind: 'UnknownContent' });
    expect(state.armory).toEqual([item]);
    expect(gainGold).not.toHaveBeenCalled();
  });

  it('keeps the item when it passes the loot filter', () => {
    const item = buildArmoryItem();
    vi.mocked(addArmoryItems).mockImplementation((state, _id, items) => {
      (state as GameState).armory = [...state.armory, ...items];
      return items;
    });
    vi.mocked(getEntry).mockReturnValue(sword);
    const state = {
      armory: [],
      lootFilters: keepAll(),
    } as unknown as GameState;
    runWith(state);

    const outcome = armoryAddLootDrop(SWORD_ID);

    expect(outcome).toEqual({ kind: 'Kept', content: sword });
    expect(state.armory).toEqual([item]);
    expect(gainGold).not.toHaveBeenCalled();
  });

  it('sells the item for 80% of its value without ever touching the armory when it fails the loot filter', () => {
    vi.mocked(getEntry).mockReturnValue(sword);
    vi.mocked(equipmentSellValue).mockReturnValue(100);

    const filters = keepAll();
    filters.keepRarities.Common = false;
    const state = { armory: [], lootFilters: filters } as unknown as GameState;
    runWith(state);

    const outcome = armoryAddLootDrop(SWORD_ID);

    expect(outcome).toEqual({
      kind: 'AutoSold',
      content: sword,
      goldEarned: 80,
    });
    expect(addArmoryItems).not.toHaveBeenCalled();
    expect(state.armory).toEqual([]);
    expect(gainGold).toHaveBeenCalledWith(state, 80);
    expect(markEquipmentDiscovered).toHaveBeenCalledWith(state, SWORD_ID);
  });

  it('still auto-sells a drop that fails the filter even when the armory has no room', () => {
    vi.mocked(getEntry).mockReturnValue(sword);
    vi.mocked(equipmentSellValue).mockReturnValue(100);
    vi.mocked(addArmoryItems).mockReturnValue([]);

    const filters = keepAll();
    filters.keepRarities.Common = false;
    const state = { armory: [], lootFilters: filters } as unknown as GameState;
    runWith(state);

    const outcome = armoryAddLootDrop(SWORD_ID);

    expect(outcome).toEqual({
      kind: 'AutoSold',
      content: sword,
      goldEarned: 80,
    });
    expect(addArmoryItems).not.toHaveBeenCalled();
    expect(gainGold).toHaveBeenCalledWith(state, 80);
  });
});
