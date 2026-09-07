import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import type {
  EquipmentContent,
  EquipmentId,
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

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { equipmentItemInfusionBonus } from '@helpers/item/infusion';
import {
  armoryAdd,
  armoryGet,
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
};

const shield: EquipmentContent = {
  ...sword,
  id: 'shield' as EquipmentId,
  name: 'Shield',
  description: 'A sturdy protective shield.',
  rarity: 'Rare',
  type: 'Shield',
};

describe('Armory Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('armoryGet', () => {
    it('returns the armory list from state', () => {
      const armory = [{ equipmentId: 'sword' as EquipmentId }];
      vi.mocked(gamestate).mockReturnValue({ armory } as unknown as GameState);

      expect(armoryGet()).toBe(armory);
    });
  });

  describe('armoryAdd', () => {
    it('appends the equipment item to the armory', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [{ equipmentId: 'shield' as EquipmentId }],
        discoveredEquipment: {},
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
        discoveredEquipment: {},
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
        discoveredEquipment: {},
      } as unknown as GameState);

      expect(result.discoveredEquipment['sword'].foundAt).toBeGreaterThan(0);
    });

    it('preserves the original discovery timestamp on repeat finds', () => {
      armoryAdd('sword' as EquipmentId);

      const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
      const result = updateFn({
        armory: [],
        discoveredEquipment: { sword: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(result.discoveredEquipment['sword']).toEqual({ foundAt: 1000 });
    });
  });

  describe('isEquipmentDiscovered', () => {
    it('returns true once the equipment has ever been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredEquipment: { sword: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(true);
    });

    it('returns true even if the equipment is no longer in the armory', () => {
      vi.mocked(gamestate).mockReturnValue({
        armory: [],
        discoveredEquipment: { sword: { foundAt: 1000 } },
      } as unknown as GameState);

      expect(isEquipmentDiscovered('sword' as EquipmentId)).toBe(true);
    });

    it('returns false when the equipment has never been found', () => {
      vi.mocked(gamestate).mockReturnValue({
        discoveredEquipment: {},
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
      const armory = [{ equipmentId: 'sword' as EquipmentId }];

      expect(pruneInvalidArmoryItems(armory)).toEqual(armory);
    });

    it('drops entries whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const armory = [{ equipmentId: 'sword' as EquipmentId }];

      expect(pruneInvalidArmoryItems(armory)).toEqual([]);
    });

    it('prunes only the invalid entries out of a mixed list', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'sword' ? { id: 'sword' } : undefined) as never,
      );
      const armory = [
        { equipmentId: 'sword' as EquipmentId },
        { equipmentId: 'stale-gear' as EquipmentId },
      ];

      expect(pruneInvalidArmoryItems(armory)).toEqual([
        { equipmentId: 'sword' },
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

      // statTotal 5 -> 5*20 + 2*10 = 120, Common multiplier 1x
      expect(equipmentSellValue(entry)).toBe(120);
    });

    it('adds infusion bonus stats on top of base stats', () => {
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

      // statTotal 8 -> 8*20 + 2*10 = 180
      expect(equipmentSellValue(entry)).toBe(180);
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

      // same base 120 as the bare-item case, plus the flat 250 affix bonus, unscaled by rarity
      expect(equipmentSellValue(entry)).toBe(370);
    });

    it('adds 50g per point of the equipment content combatStats, unscaled by rarity', () => {
      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [],
          affixIds: [],
        },
        content: {
          ...sword,
          baseStats: defaultStats(),
          levelRequirement: 0,
          combatStats: { ...defaultCombatStats(), reviveChance: 2 },
        },
      };

      // base 0 stats/level -> 0, plus 2 combat stat points * 50g
      expect(equipmentSellValue(entry)).toBe(100);
    });

    it('adds a CombatStat affix bonus as a flat amount after the rarity multiplier', () => {
      const combatStatAffix = {
        id: 'affix-combat-stat' as never,
        rarity: 'Uncommon',
        family: 'DamageReflect',
        effects: [
          { kind: 'CombatStat', stat: 'damageReflectPercent', value: 3 },
        ],
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === combatStatAffix.id ? combatStatAffix : undefined) as never,
      );

      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [],
          affixIds: [combatStatAffix.id],
        },
        content: {
          ...sword,
          baseStats: defaultStats(),
          levelRequirement: 0,
        },
      };

      // base 0 stats/level -> 0, plus 3 combat stat points * 50g
      expect(equipmentSellValue(entry)).toBe(150);
    });

    it('adds 100g per point of the equipment content debuffResistances, unscaled by rarity', () => {
      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [],
          affixIds: [],
        },
        content: {
          ...sword,
          baseStats: defaultStats(),
          levelRequirement: 0,
          debuffResistances: { ...defaultTagResistances(), Stun: 2 },
        },
      };

      // base 0 stats/level -> 0, plus 2 resistance points * 100g
      expect(equipmentSellValue(entry)).toBe(200);
    });

    it('adds infusion and Resistance-affix bonuses on top of the content debuffResistances', () => {
      const stunAffix = {
        id: 'affix-stun' as never,
        rarity: 'Uncommon',
        family: 'StunResist',
        effects: [{ kind: 'Resistance', tag: 'Stun', value: 3 }],
      };
      const spiritFlesh = {
        id: 'spirit-flesh' as never,
        infusionDebuffResistances: { ...defaultTagResistances(), Stun: 1 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === stunAffix.id
            ? stunAffix
            : id === spiritFlesh.id
              ? spiritFlesh
              : undefined) as never,
      );

      const entry = {
        item: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: sword.id,
          infusedItemIds: [spiritFlesh.id],
          affixIds: [stunAffix.id],
        },
        content: {
          ...sword,
          baseStats: defaultStats(),
          levelRequirement: 0,
          debuffResistances: { ...defaultTagResistances(), Stun: 2 },
        },
      };

      // base 0 stats/level -> 0, plus (2 + 1 + 3) resistance points * 100g
      expect(equipmentSellValue(entry)).toBe(600);
    });
  });
});
