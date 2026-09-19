import { defaultStats } from '@helpers/defaults';
import type {
  AffixId,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  ItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/infusion', () => ({
  equipmentItemInfusionBonus: vi.fn(),
}));

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    armoryState: () => gamestate().armory,
    globalEffectSumsState: () => gamestate().globalEffectSums,
    discoveredEquipmentState: () => gamestate().discoveredEquipment,
  };
});

import { deepFreeze } from '@helpers/engine/deep-freeze';
import { getEntry } from '@helpers/content/content';
import { equipmentItemInfusionBonus } from '@helpers/item/infusion';
import {
  addArmoryItems,
  armoryAdd,
  armoryAddWithAffixes,
  armoryCap,
  armoryGet,
  armoryHasRoom,
  armoryHasRoomFor,
  armoryHasRoomForState,
  armoryOverflowCap,
  equipmentSellValue,
  getArmoryEntries,
  isEquipmentDiscovered,
  pruneInvalidArmoryItems,
  pruneInvalidDiscoveredEquipment,
} from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';

const sword: EquipmentContent = {
  id: 'sword' as EquipmentId,
  name: 'Sword',
  __type: 'equipment',
  description: 'A sharp blade.',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: defaultStats(),
  type: 'Sword',
  slots: 1,
  grantedSkillIds: [],
};

const shield: EquipmentContent = {
  ...sword,
  id: 'shield' as EquipmentId,
  name: 'Shield',
  description: 'A sturdy protective shield.',
  rarity: 'Rare',
  type: 'Shield',
};

function buildArmoryItem(equipmentId: EquipmentId): EquipmentItem {
  return {
    id: `${equipmentId}-item` as EquipmentItemId,
    equipmentId,
    infusedItemIds: [],
    affixIds: [],
  };
}

describe('Armory Helper Functions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('armoryGet', () => {
    it('returns the armory list from state', () => {
      const armory = [{ equipmentId: 'sword' as EquipmentId }];
      vi.mocked(gamestate).mockReturnValue({ armory } as unknown as GameState);

      expect(armoryGet()).toBe(armory);
    });
  });

  function mockZeroArmoryBoost(): void {
    vi.mocked(gamestate).mockReturnValue({
      globalEffectSums: { armorySizeBoost: 0 },
    } as unknown as GameState);
  }

  describe('armoryCap / armoryOverflowCap', () => {
    it('caps the armory at 50 items', () => {
      mockZeroArmoryBoost();
      expect(armoryCap()).toBe(50);
    });

    it('allows drops to overshoot the cap by 25%, floored', () => {
      mockZeroArmoryBoost();
      expect(armoryOverflowCap()).toBe(62);
    });

    it('adds any active armory size boost on top of the base cap', () => {
      vi.mocked(gamestate).mockReturnValue({
        globalEffectSums: { armorySizeBoost: 15 },
      } as unknown as GameState);

      expect(armoryCap()).toBe(65);
    });
  });

  describe('armoryHasRoomForState', () => {
    function stateWith(count: number, armorySizeBoost = 0): GameState {
      return {
        armory: Array.from({ length: count }),
        globalEffectSums: { armorySizeBoost },
      } as unknown as GameState;
    }

    it('uses the passed state cap, including a boost applied earlier in the same callback', () => {
      expect(armoryHasRoomForState(stateWith(50), 1)).toBe(false);
      expect(armoryHasRoomForState(stateWith(50, 5), 1)).toBe(true);
    });

    it('allows overflow up to the state overflow cap when requested', () => {
      expect(armoryHasRoomForState(stateWith(61), 1, true)).toBe(true);
      expect(armoryHasRoomForState(stateWith(62), 1, true)).toBe(false);
    });

    it('accounts for a multi-item quantity', () => {
      expect(armoryHasRoomForState(stateWith(45), 5)).toBe(true);
      expect(armoryHasRoomForState(stateWith(45), 6)).toBe(false);
    });
  });

  describe('armoryHasRoomFor / armoryHasRoom', () => {
    beforeEach(() => {
      mockZeroArmoryBoost();
    });

    it('has room under the strict cap', () => {
      expect(armoryHasRoomFor(49)).toBe(true);
    });

    it('has no room at the strict cap', () => {
      expect(armoryHasRoomFor(50)).toBe(false);
    });

    it('allows overflow up to the overflow cap when requested', () => {
      expect(armoryHasRoomFor(50, 1, true)).toBe(true);
      expect(armoryHasRoomFor(61, 1, true)).toBe(true);
      expect(armoryHasRoomFor(62, 1, true)).toBe(false);
    });

    it('accounts for a multi-item quantity', () => {
      expect(armoryHasRoomFor(45, 5)).toBe(true);
      expect(armoryHasRoomFor(45, 6)).toBe(false);
    });

    it('reads the live armory length via armoryHasRoom', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: Array.from({ length: 50 }),
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(armoryHasRoom()).toBe(false);
      expect(armoryHasRoom(1, true)).toBe(true);
    });
  });

  describe('armoryAdd', () => {
    it('appends the equipment item to the armory', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [{ equipmentId: 'shield' as EquipmentId }],
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(result.armory).toEqual([
        { equipmentId: 'shield' },
        {
          id: expect.any(String),
          equipmentId: 'sword',
          infusedItemIds: [],
          affixIds: [],
        },
      ]);
    });

    it('appends multiple copies when given a quantity, each its own instance', () => {
      armoryAdd('sword' as EquipmentId, 3);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(result.armory).toHaveLength(3);
      result.armory.forEach((item) => {
        expect(item).toEqual({
          id: expect.any(String),
          equipmentId: 'sword',
          infusedItemIds: [],
          affixIds: [],
        });
      });

      const ids = new Set(result.armory.map((item) => item.id));
      expect(ids.size).toBe(3);
    });

    it('does nothing for a zero or negative quantity', () => {
      armoryAdd('sword' as EquipmentId, 0);
      armoryAdd('sword' as EquipmentId, -1);

      expect(updateGamestate).not.toHaveBeenCalled();
    });

    it('marks the equipment as permanently discovered', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(
        result.discoveredEquipment['sword' as EquipmentId].foundAt,
      ).toBeGreaterThan(0);
    });

    it('preserves the original discovery timestamp on repeat finds', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: deepFreeze({ sword: { foundAt: 1000 } }),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(result.discoveredEquipment['sword' as EquipmentId]).toEqual({
        foundAt: 1000,
      });
    });

    it('rejects everything once the strict cap is already reached', () => {
      armoryAdd('sword' as EquipmentId, 3);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: Array.from({ length: 50 }, () => ({
          equipmentId: 'shield' as EquipmentId,
        })),
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(result.armory).toHaveLength(50);
    });
  });

  describe('addArmoryItems - cap clamping', () => {
    function buildItems(
      equipmentId: EquipmentId,
      count: number,
    ): EquipmentItem[] {
      return Array.from({ length: count }, () => buildArmoryItem(equipmentId));
    }

    it('admits only as many as fit under the strict cap', () => {
      const state = {
        armory: buildItems('shield' as EquipmentId, 48),
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState;

      const admitted = addArmoryItems(
        state,
        'sword' as EquipmentId,
        buildItems('sword' as EquipmentId, 5),
      );

      expect(state.armory).toHaveLength(50);
      expect(admitted).toHaveLength(2);
    });

    it('rejects everything once the strict cap is already reached', () => {
      const state = {
        armory: buildItems('shield' as EquipmentId, 50),
        discoveredEquipment: deepFreeze({}),
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState;

      const admitted = addArmoryItems(
        state,
        'sword' as EquipmentId,
        buildItems('sword' as EquipmentId, 3),
      );

      expect(state.armory).toHaveLength(50);
      expect(admitted).toHaveLength(0);
    });

    it('admits up to the overflow cap when allowOverflow is set', () => {
      const state = {
        armory: buildItems('shield' as EquipmentId, 60),
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState;

      const admitted = addArmoryItems(
        state,
        'sword' as EquipmentId,
        buildItems('sword' as EquipmentId, 5),
        true,
      );

      expect(state.armory).toHaveLength(62);
      expect(admitted).toHaveLength(2);
    });

    it('ignores the cap entirely when bypassCap is set', () => {
      const state = {
        armory: buildItems('shield' as EquipmentId, 60),
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState;

      const admitted = addArmoryItems(
        state,
        'sword' as EquipmentId,
        buildItems('sword' as EquipmentId, 5),
        false,
        true,
      );

      expect(state.armory).toHaveLength(65);
      expect(admitted).toHaveLength(5);
    });

    it('syncs the armory-fullness global effect when an add crosses a tier boundary', () => {
      const overburdened = {
        id: 'armory-overburdened-id' as never,
        name: 'Overburdened',
        __type: 'globaleffect',
        description: 'The armory is full.',
        sprite: '0000',
        effects: [],
      };
      vi.mocked(getEntry).mockImplementation((key) =>
        key === 'Overburdened' || key === overburdened.id
          ? (overburdened as never)
          : undefined,
      );
      vi.mocked(gamestate).mockReturnValue({
        clock: { numTicks: 500 },
      } as unknown as GameState);

      const state = {
        armory: buildItems('shield' as EquipmentId, 49),
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState;

      addArmoryItems(state, 'sword' as EquipmentId, [
        buildArmoryItem('sword' as EquipmentId),
      ]);

      expect(state.armory).toHaveLength(50);
      expect(state.globalEffects.map((e) => e.id)).toEqual([overburdened.id]);
    });
  });

  describe('armoryAddWithAffixes', () => {
    it('appends one item carrying exactly the given affixIds, not a random roll', () => {
      const affixIds = ['affix-str', 'affix-vit'] as AffixId[];

      armoryAddWithAffixes('sword' as EquipmentId, affixIds);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [{ equipmentId: 'shield' as EquipmentId }],
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(result.armory).toEqual([
        { equipmentId: 'shield' },
        {
          id: expect.any(String),
          equipmentId: 'sword',
          infusedItemIds: [],
          affixIds,
        },
      ]);
    });

    it('marks the equipment as permanently discovered', () => {
      armoryAddWithAffixes('sword' as EquipmentId, []);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: deepFreeze({}),
        collectibles: {},
        globalEffects: [],
        globalEffectSums: { armorySizeBoost: 0 },
      } as unknown as GameState);

      expect(
        result.discoveredEquipment['sword' as EquipmentId].foundAt,
      ).toBeGreaterThan(0);
    });
  });

  describe('isEquipmentDiscovered', () => {
    it('returns true once the equipment has ever been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredEquipment: deepFreeze({ sword: { foundAt: 1000 } }),
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(true);
    });

    it('returns true even if the equipment is no longer in the armory', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [],
        discoveredEquipment: deepFreeze({ sword: { foundAt: 1000 } }),
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(true);
    });

    it('returns false when the equipment has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredEquipment: deepFreeze({}),
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(false);
    });
  });

  describe('pruneInvalidDiscoveredEquipment', () => {
    it('keeps entries that resolve to real equipment content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: 'sword' } as EquipmentContent);
      const discovered = { ['sword' as EquipmentId]: { foundAt: 1000 } };

      expect(pruneInvalidDiscoveredEquipment(discovered)).toEqual(discovered);
    });

    it('drops entries whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const discovered = {
        ['stale-gear' as EquipmentId]: { foundAt: 1000 },
      };

      expect(pruneInvalidDiscoveredEquipment(discovered)).toEqual({});
    });
  });

  describe('pruneInvalidArmoryItems', () => {
    it('keeps entries that resolve to real equipment content', () => {
      vi.mocked(getEntry).mockReturnValue({ id: 'sword' } as EquipmentContent);
      const armory = [buildArmoryItem('sword' as EquipmentId)];

      expect(pruneInvalidArmoryItems(armory)).toEqual(armory);
    });

    it('drops entries whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const armory = [buildArmoryItem('sword' as EquipmentId)];

      expect(pruneInvalidArmoryItems(armory)).toEqual([]);
    });

    it('prunes only the invalid entries out of a mixed list', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'sword' ? { id: 'sword' } : undefined) as never,
      );
      const armory = [
        buildArmoryItem('sword' as EquipmentId),
        buildArmoryItem('stale-gear' as EquipmentId),
      ];

      expect(pruneInvalidArmoryItems(armory)).toEqual([
        buildArmoryItem('sword' as EquipmentId),
      ]);
    });

    it('returns an empty array for an empty input', () => {
      expect(pruneInvalidArmoryItems([])).toEqual([]);
    });
  });

  describe('getArmoryEntries', () => {
    it('returns one entry per owned item, without merging duplicates, sorted by rarity then name', () => {
      const swordItem1 = {
        id: 'sword-1' as EquipmentItemId,
        equipmentId: sword.id,
        infusedItemIds: [],
      };
      const shieldItem = {
        id: 'shield-1' as EquipmentItemId,
        equipmentId: shield.id,
        infusedItemIds: [],
      };
      const swordItem2 = {
        id: 'sword-2' as EquipmentItemId,
        equipmentId: sword.id,
        infusedItemIds: [],
      };

      vi.mocked(gamestate).mockReturnValue({
        armory: [swordItem1, shieldItem, swordItem2],
      } as unknown as GameState);
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === sword.id ? sword : shield) as never,
      );

      expect(getArmoryEntries()).toEqual([
        { item: shieldItem, content: shield },
        { item: swordItem1, content: sword },
        { item: swordItem2, content: sword },
      ]);
    });

    it('excludes entries with no matching content entry', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [
          {
            id: 'sword-1' as EquipmentItemId,
            equipmentId: sword.id,
            infusedItemIds: [],
          },
        ],
      } as unknown as GameState);
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(getArmoryEntries()).toEqual([]);
    });

    it('returns an empty array when the armory is empty', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [],
      } as unknown as GameState);

      expect(getArmoryEntries()).toEqual([]);
    });
  });

  describe('equipmentSellValue', () => {
    beforeEach(() => {
      vi.mocked(equipmentItemInfusionBonus).mockReturnValue(defaultStats());
    });

    it('prices a bare item from its base stats and level, scaled by rarity', () => {
      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [],
          affixIds: [],
        },
        content: {
          ...sword,
          baseStats: { ...defaultStats(), Strength: 5 },
          levelRequirement: 2,
        },
      };

      expect(equipmentSellValue(entry)).toBe(520);
    });

    // Base Strength 5 + infusion Strength 3, both weighted x5 (VALUE_MULTIPLIER_PER_STAT.Strength): (5*5 + 3*5)*20 + 2*10 = 820.
    it('adds infusion bonus stats on top of base stats, weighted the same as base stats', () => {
      vi.mocked(equipmentItemInfusionBonus).mockReturnValue({
        ...defaultStats(),
        Strength: 3,
      });
      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: ['crystal' as ItemId],
          affixIds: [],
        },
        content: {
          ...sword,
          baseStats: { ...defaultStats(), Strength: 5 },
          levelRequirement: 2,
        },
      };

      expect(equipmentSellValue(entry)).toBe(820);
    });

    it('never returns less than 1 gold', () => {
      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [],
          affixIds: [],
        },
        content: { ...sword, baseStats: defaultStats(), levelRequirement: 0 },
      };

      expect(equipmentSellValue(entry)).toBe(1);
    });

    it('adds a SellValue affix bonus as a flat amount after the rarity multiplier', () => {
      const sellValueAffix = {
        id: 'affix-sell' as never,
        rarity: 'Uncommon',
        family: 'SellValue',
        effects: [{ kind: 'SellValue', value: 250 }],
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === sellValueAffix.id ? sellValueAffix : undefined) as never,
      );

      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [],
          affixIds: [sellValueAffix.id],
        },
        content: {
          ...sword,
          baseStats: { ...defaultStats(), Strength: 5 },
          levelRequirement: 2,
        },
      };

      expect(equipmentSellValue(entry)).toBe(770);
    });
  });
});
