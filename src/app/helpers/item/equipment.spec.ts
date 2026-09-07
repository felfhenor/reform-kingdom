import type {
  AffixContent,
  AffixId,
  Character,
  CharacterId,
  Combat,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  JobContent,
  JobId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(),
}));

import { currentCombat } from '@helpers/combat/combat-state';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  backfillEquipmentItem,
  canEquipItem,
  canModifyEquipment,
  characterTagResistances,
  equipmentAffixEffects,
  equipmentCombatStatTotals,
  equipmentGrantedSkillIds,
  equipmentStatTotals,
  equipmentTagResistanceTotals,
  equippedItems,
  equippedItemsByPrimarySlot,
  equippedItemTypes,
  isSlotAvailableForJob,
  newEquipmentItem,
  planEquipmentOptimization,
  pruneInvalidEquippedItems,
  slotsHoldingEquipment,
} from '@helpers/item/equipment';

// Dedup is keyed by instance id, not content id, so each distinct physical item needs its own id (a two-hander reuses the same instance across both slots).
function mockEquipmentItem(
  equipmentId: EquipmentId,
  id = equipmentId,
): EquipmentItem {
  return {
    id: id as unknown as EquipmentItemId,
    equipmentId,
    infusedItemIds: [],
    affixIds: [],
  };
}

describe('Equipment Helper Functions', () => {
  const sword: EquipmentContent = {
    id: 'sword' as EquipmentId,
    name: 'Sword',
    __type: 'equipment',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    levelRequirement: 1,
    baseStats: {
      Health: 0,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 5,
      Vitality: 0,
      Resistance: 0,
      Agility: 1,
    },
    type: 'Sword',
    slots: 1,
  };

  const helmet: EquipmentContent = {
    ...sword,
    id: 'helmet' as EquipmentId,
    name: 'Helmet',
    baseStats: {
      Health: 10,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 0,
      Vitality: 2,
      Resistance: 1,
      Agility: 0,
    },
    type: 'Hat',
  };

  const spear: EquipmentContent = {
    ...sword,
    id: 'spear' as EquipmentId,
    name: 'Copper Spear',
    baseStats: {
      Health: 0,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 3,
      Vitality: 0,
      Resistance: 0,
      Agility: 0,
    },
    type: 'Spear',
  };

  const emptyEquipment: EquipmentBlock = {
    Armor: undefined,
    Helmet: undefined,
    Weapon: undefined,
    Offhand: undefined,
    Ring: undefined,
    Accessory: undefined,
    Artifact: undefined,
    Ammo: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('equipmentStatTotals', () => {
    it('should return zeroed stats when nothing is equipped', () => {
      expect(equipmentStatTotals(emptyEquipment)).toEqual({
        Health: 0,
        Energy: 0,
        Luck: 0,
        Intelligence: 0,
        Strength: 0,
        Vitality: 0,
        Resistance: 0,
        Agility: 0,
      });
      expect(getEntry).not.toHaveBeenCalled();
    });

    it('should sum baseStats across all equipped slots', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'sword' ? sword : helmet) as never,
      );

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
        Helmet: mockEquipmentItem(helmet.id),
      });

      expect(totals).toEqual({
        Health: 10,
        Energy: 0,
        Luck: 0,
        Intelligence: 0,
        Strength: 5,
        Vitality: 2,
        Resistance: 1,
        Agility: 1,
      });
    });

    it('should ignore slots whose equipment content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem('missing' as EquipmentId),
      });

      expect(totals).toEqual({
        Health: 0,
        Energy: 0,
        Luck: 0,
        Intelligence: 0,
        Strength: 0,
        Vitality: 0,
        Resistance: 0,
        Agility: 0,
      });
    });

    it('should count a two-handed item once even though it occupies two slots', () => {
      vi.mocked(getEntry).mockReturnValue(spear);
      const spearItem = mockEquipmentItem(spear.id);

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      });

      expect(totals.Strength).toBe(spear.baseStats.Strength);
    });

    it("adds each equipped item's infusion bonus on top of its baseStats", () => {
      const infusionCrystal = {
        id: 'crystal' as never,
        name: 'Crystal',
        __type: 'item',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        infusionStats: {
          Health: 0,
          Energy: 0,
          Luck: 0,
          Intelligence: 0,
          Strength: 2,
          Vitality: 0,
          Resistance: 0,
          Agility: 0,
        },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? sword
            : id === 'crystal'
              ? infusionCrystal
              : undefined) as never,
      );

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          infusedItemIds: ['crystal' as never],
        },
      });

      expect(totals.Strength).toBe(sword.baseStats.Strength + 2);
    });

    it("adds a rolled Stat affix's value on top of baseStats", () => {
      const strengthAffix = {
        id: 'affix-str' as never,
        rarity: 'Common',
        family: 'Strength',
        effects: [{ kind: 'Stat', stat: 'Strength', value: 4 }],
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? sword
            : id === strengthAffix.id
              ? strengthAffix
              : undefined) as never,
      );

      const totals = equipmentStatTotals({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          affixIds: [strengthAffix.id],
        },
      });

      expect(totals.Strength).toBe(sword.baseStats.Strength + 4);
    });
  });

  describe('equipmentTagResistanceTotals', () => {
    const zeroResistances = {
      Stun: 0,
      StatDown: 0,
      Accuracy: 0,
      DamageOverTime: 0,
      Poison: 0,
      Burn: 0,
    };

    it('should return zeroed resistances when nothing is equipped', () => {
      expect(equipmentTagResistanceTotals(emptyEquipment)).toEqual(
        zeroResistances,
      );
      expect(getEntry).not.toHaveBeenCalled();
    });

    it('should sum debuffResistances across all equipped slots', () => {
      const poisonHelmet = {
        ...helmet,
        debuffResistances: { ...zeroResistances, Poison: 5 },
      };
      const stunSword = {
        ...sword,
        debuffResistances: { ...zeroResistances, Stun: 3 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'sword' ? stunSword : poisonHelmet) as never,
      );

      const totals = equipmentTagResistanceTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
        Helmet: mockEquipmentItem(helmet.id),
      });

      expect(totals).toEqual({ ...zeroResistances, Stun: 3, Poison: 5 });
    });

    it('should additively stack the same tag across multiple equipped items', () => {
      const poisonHelmet = {
        ...helmet,
        debuffResistances: { ...zeroResistances, Poison: 5 },
      };
      const poisonSword = {
        ...sword,
        debuffResistances: { ...zeroResistances, Poison: 3 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'sword' ? poisonSword : poisonHelmet) as never,
      );

      const totals = equipmentTagResistanceTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
        Helmet: mockEquipmentItem(helmet.id),
      });

      expect(totals.Poison).toBe(8);
    });

    it("adds each equipped item's infusion resistance bonus on top of its debuffResistances", () => {
      const spiritFlesh = {
        id: 'spirit-flesh' as never,
        name: 'Spirit Flesh',
        __type: 'item',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        infusionDebuffResistances: { ...zeroResistances, StatDown: 2 },
      };
      const statDownSword = {
        ...sword,
        debuffResistances: { ...zeroResistances, StatDown: 3 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? statDownSword
            : id === 'spirit-flesh'
              ? spiritFlesh
              : undefined) as never,
      );

      const totals = equipmentTagResistanceTotals({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          infusedItemIds: ['spirit-flesh' as never],
        },
      });

      expect(totals.StatDown).toBe(5);
    });

    it("adds a rolled Resistance affix's value on top of debuffResistances", () => {
      const stunAffix = {
        id: 'affix-stun' as never,
        rarity: 'Uncommon',
        family: 'StunResist',
        effects: [{ kind: 'Resistance', tag: 'Stun', value: 10 }],
      };
      const stunSword = {
        ...sword,
        debuffResistances: { ...zeroResistances, Stun: 3 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? stunSword
            : id === stunAffix.id
              ? stunAffix
              : undefined) as never,
      );

      const totals = equipmentTagResistanceTotals({
        ...emptyEquipment,
        Weapon: { ...mockEquipmentItem(sword.id), affixIds: [stunAffix.id] },
      });

      expect(totals.Stun).toBe(13);
    });
  });

  describe('equipmentCombatStatTotals', () => {
    const zeroCombatStats = {
      repeatActionChance: 0,
      skillStrikeAgainChance: 0,
      redirectionChance: 0,
      missChance: 0,
      debuffIgnoreChance: 0,
      damageReflectPercent: 0,
      healingIgnorePercent: 0,
      reviveChance: 0,
      stunChance: 0,
      agroValue: 0,
    };

    it('should return zeroed combat stats when nothing is equipped', () => {
      expect(equipmentCombatStatTotals(emptyEquipment)).toEqual(
        zeroCombatStats,
      );
      expect(getEntry).not.toHaveBeenCalled();
    });

    it('should sum combatStats across all equipped slots', () => {
      const reflectiveSword = {
        ...sword,
        combatStats: { ...zeroCombatStats, damageReflectPercent: 10 },
      };
      const luckyHelmet = {
        ...helmet,
        combatStats: { ...zeroCombatStats, reviveChance: 5 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'sword' ? reflectiveSword : luckyHelmet) as never,
      );

      const totals = equipmentCombatStatTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
        Helmet: mockEquipmentItem(helmet.id),
      });

      expect(totals).toEqual({
        ...zeroCombatStats,
        damageReflectPercent: 10,
        reviveChance: 5,
      });
    });

    it('should ignore equipment content with no combatStats field at all', () => {
      vi.mocked(getEntry).mockReturnValue(sword);

      const totals = equipmentCombatStatTotals({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
      });

      expect(totals).toEqual(zeroCombatStats);
    });

    it("adds each equipped item's infusion combat-stat bonus on top of its combatStats", () => {
      const vengeanceShard = {
        id: 'vengeance-shard' as never,
        name: 'Vengeance Shard',
        __type: 'item',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        infusionCombatStats: { ...zeroCombatStats, damageReflectPercent: 3 },
      };
      const reflectiveSword = {
        ...sword,
        combatStats: { ...zeroCombatStats, damageReflectPercent: 10 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? reflectiveSword
            : id === 'vengeance-shard'
              ? vengeanceShard
              : undefined) as never,
      );

      const totals = equipmentCombatStatTotals({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          infusedItemIds: ['vengeance-shard' as never],
        },
      });

      expect(totals.damageReflectPercent).toBe(13);
    });

    it("adds a rolled CombatStat affix's value on top of combatStats", () => {
      const reflectAffix = {
        id: 'affix-reflect' as never,
        rarity: 'Uncommon',
        family: 'DamageReflect',
        effects: [
          { kind: 'CombatStat', stat: 'damageReflectPercent', value: 7 },
        ],
      };
      const reflectiveSword = {
        ...sword,
        combatStats: { ...zeroCombatStats, damageReflectPercent: 10 },
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? reflectiveSword
            : id === reflectAffix.id
              ? reflectAffix
              : undefined) as never,
      );

      const totals = equipmentCombatStatTotals({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          affixIds: [reflectAffix.id],
        },
      });

      expect(totals.damageReflectPercent).toBe(17);
    });
  });

  describe('characterTagResistances', () => {
    it("delegates to equipmentTagResistanceTotals with the character's equipment", () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      const character = { equipment: emptyEquipment } as Character;
      expect(characterTagResistances(character)).toEqual({
        Stun: 0,
        StatDown: 0,
        Accuracy: 0,
        DamageOverTime: 0,
        Poison: 0,
        Burn: 0,
      });
    });
  });

  describe('equipmentGrantedSkillIds', () => {
    it('returns the grantedSkillIds of each distinct equipped item', () => {
      const staff = {
        ...sword,
        id: 'staff' as EquipmentId,
        grantedSkillIds: ['starshine-2'],
      };
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === 'staff' ? staff : undefined) as never,
      );

      const skillIds = equipmentGrantedSkillIds({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(staff.id),
      });

      expect(skillIds).toEqual(['starshine-2']);
    });

    it('dedupes a skill granted by more than one equipped item', () => {
      const staff = {
        ...sword,
        id: 'staff' as EquipmentId,
        grantedSkillIds: ['starshine-2'],
      };
      const ring = {
        ...sword,
        id: 'ring' as EquipmentId,
        grantedSkillIds: ['starshine-2'],
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'staff' ? staff : id === 'ring' ? ring : undefined) as never,
      );

      const skillIds = equipmentGrantedSkillIds({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(staff.id),
        Ring: mockEquipmentItem(ring.id),
      });

      expect(skillIds).toEqual(['starshine-2']);
    });

    it('returns an empty array when no equipped item grants a skill', () => {
      vi.mocked(getEntry).mockReturnValue(sword);

      const skillIds = equipmentGrantedSkillIds({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
      });

      expect(skillIds).toEqual([]);
    });

    it("includes a rolled GrantSkill affix's skillId alongside content-granted skills", () => {
      const grantAffix = {
        id: 'affix-grant' as never,
        rarity: 'Mystical',
        family: 'GrantAttack',
        effects: [{ kind: 'GrantSkill', skillId: 'attack' }],
      };
      vi.mocked(getEntry).mockImplementation(
        (id) =>
          (id === 'sword'
            ? sword
            : id === grantAffix.id
              ? grantAffix
              : undefined) as never,
      );

      const skillIds = equipmentGrantedSkillIds({
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          affixIds: [grantAffix.id],
        },
      });

      expect(skillIds).toEqual(['attack']);
    });
  });

  describe('equippedItems', () => {
    it('returns one entry per distinct equipped item', () => {
      const swordItem = mockEquipmentItem(sword.id);
      const helmetItem = mockEquipmentItem(helmet.id);

      const items = equippedItems({
        ...emptyEquipment,
        Weapon: swordItem,
        Helmet: helmetItem,
      });

      expect(items).toHaveLength(2);
      expect(items).toEqual(expect.arrayContaining([swordItem, helmetItem]));
    });

    it('collapses a two-handed item occupying multiple slots into a single entry', () => {
      const spearItem = mockEquipmentItem(spear.id);

      const items = equippedItems({
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      });

      expect(items).toEqual([spearItem]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItems(emptyEquipment)).toEqual([]);
    });
  });

  describe('equippedItemsByPrimarySlot', () => {
    it('returns one entry per distinct equipped item, keyed by slot', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === sword.id ? sword : helmet) as never,
      );
      const swordItem = mockEquipmentItem(sword.id);
      const helmetItem = mockEquipmentItem(helmet.id);

      const items = equippedItemsByPrimarySlot({
        ...emptyEquipment,
        Weapon: swordItem,
        Helmet: helmetItem,
      });

      expect(items).toHaveLength(2);
      expect(items).toEqual(expect.arrayContaining([swordItem, helmetItem]));
    });

    it('only returns a two-handed item once, from its primary slot', () => {
      vi.mocked(getEntry).mockReturnValue(spear);
      const spearItem = mockEquipmentItem(spear.id);

      const items = equippedItemsByPrimarySlot({
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      });

      expect(items).toEqual([spearItem]);
    });

    // Guards against a legacy save backfilled with a different instance id per slot.
    it('only returns a two-handed item once even if its slots hold different instance ids', () => {
      vi.mocked(getEntry).mockReturnValue(spear);

      const items = equippedItemsByPrimarySlot({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(spear.id, 'weapon-instance' as EquipmentId),
        Offhand: mockEquipmentItem(spear.id, 'offhand-instance' as EquipmentId),
      });

      expect(items).toHaveLength(1);
      expect(items[0].equipmentId).toBe(spear.id);
    });

    it('ignores slots whose equipment content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(
        equippedItemsByPrimarySlot({
          ...emptyEquipment,
          Weapon: mockEquipmentItem('missing' as EquipmentId),
        }),
      ).toEqual([]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItemsByPrimarySlot(emptyEquipment)).toEqual([]);
    });
  });

  describe('equippedItemTypes', () => {
    it('returns the content type of each distinct equipped item', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === sword.id ? sword : spear) as never,
      );

      const types = equippedItemTypes({
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id, 'weapon-instance' as EquipmentId),
        Offhand: mockEquipmentItem(spear.id, 'offhand-instance' as EquipmentId),
      });

      expect(types).toEqual(expect.arrayContaining(['Sword', 'Spear']));
      expect(types).toHaveLength(2);
    });

    it('ignores slots whose equipment content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      expect(
        equippedItemTypes({
          ...emptyEquipment,
          Weapon: mockEquipmentItem('missing' as EquipmentId),
        }),
      ).toEqual([]);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equippedItemTypes(emptyEquipment)).toEqual([]);
      expect(getEntry).not.toHaveBeenCalled();
    });
  });

  describe('pruneInvalidEquippedItems', () => {
    it('leaves slots whose equipment resolves to real content untouched', () => {
      vi.mocked(getEntry).mockReturnValue(sword);
      const equipment = {
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
      };

      expect(pruneInvalidEquippedItems(equipment)).toEqual(equipment);
    });

    it('clears slots whose equipmentId no longer resolves to real content', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const equipment = {
        ...emptyEquipment,
        Weapon: mockEquipmentItem('stale-gear' as EquipmentId),
      };

      expect(pruneInvalidEquippedItems(equipment)).toEqual(emptyEquipment);
    });

    it('prunes only the invalid slots out of a mix of valid and invalid gear', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === sword.id ? sword : undefined) as never,
      );
      const swordItem = mockEquipmentItem(sword.id);
      const equipment = {
        ...emptyEquipment,
        Weapon: swordItem,
        Helmet: mockEquipmentItem('stale-gear' as EquipmentId),
      };

      expect(pruneInvalidEquippedItems(equipment)).toEqual({
        ...emptyEquipment,
        Weapon: swordItem,
      });
    });

    it('returns an equivalent block when nothing is equipped', () => {
      expect(pruneInvalidEquippedItems(emptyEquipment)).toEqual(emptyEquipment);
      expect(getEntry).not.toHaveBeenCalled();
    });
  });

  describe('slotsHoldingEquipment', () => {
    it('returns every slot holding the given equipment id', () => {
      const spearItem = mockEquipmentItem(spear.id);
      const equipment = {
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      };

      expect(slotsHoldingEquipment(equipment, spear.id)).toEqual([
        'Weapon',
        'Offhand',
      ]);
    });

    it('returns an empty array when the equipment id is not equipped anywhere', () => {
      expect(slotsHoldingEquipment(emptyEquipment, spear.id)).toEqual([]);
    });

    it('does not match slots holding a different equipment id', () => {
      const equipment = {
        ...emptyEquipment,
        Weapon: mockEquipmentItem(sword.id),
      };

      expect(slotsHoldingEquipment(equipment, spear.id)).toEqual([]);
    });
  });

  describe('canModifyEquipment', () => {
    it('allows equipment changes when there is no active combat', () => {
      vi.mocked(currentCombat).mockReturnValue(undefined);

      expect(canModifyEquipment()).toBe(true);
    });

    it('blocks equipment changes while a combat is active', () => {
      vi.mocked(currentCombat).mockReturnValue({} as Combat);

      expect(canModifyEquipment()).toBe(false);
    });
  });

  describe('canEquipItem', () => {
    const character = {
      id: 'char-1' as CharacterId,
      level: 5,
      jobId: 'ranger' as JobId,
    } as Character;

    it('allows equipping when level and job requirements are met', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Sword'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 5 };
      expect(canEquipItem(character, item)).toBe(true);
    });

    it('blocks equipping when the job cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);
      const item = { ...sword, levelRequirement: 5 };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when the hero is under-level', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Sword'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 6 };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when the hero is the wrong job', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Hat'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 5 };
      expect(canEquipItem(character, item)).toBe(false);
    });

    it('blocks equipping when both level and job requirements fail', () => {
      vi.mocked(getEntry).mockReturnValue({
        equippableTypes: ['Hat'],
      } as JobContent);
      const item = { ...sword, levelRequirement: 99 };
      expect(canEquipItem(character, item)).toBe(false);
    });
  });

  describe('planEquipmentOptimization', () => {
    const job: JobContent = {
      name: 'Warrior',
      equippableTypes: ['Sword', 'Spear', 'Shield', 'Hat'],
    } as JobContent;

    function buildCharacter(overrides: Partial<Character> = {}): Character {
      return {
        id: 'char-1' as CharacterId,
        level: 5,
        jobId: 'job-warrior' as JobId,
        equipment: emptyEquipment,
        ...overrides,
      } as Character;
    }

    function mockContentEntries(...entries: { id: string }[]): void {
      const known = new Map(entries.map((entry) => [entry.id, entry]));
      known.set('job-warrior', job);
      vi.mocked(getEntry).mockImplementation(
        (id) => known.get(id as string) as never,
      );
    }

    it('prefers the candidate ranked higher by statPriority over one with a higher level requirement', () => {
      const strongSword = {
        ...sword,
        id: 'strong' as EquipmentId,
        levelRequirement: 1,
        baseStats: { ...sword.baseStats, Strength: 5 },
      };
      const weakHighLevelSword = {
        ...sword,
        id: 'weak-high-level' as EquipmentId,
        levelRequirement: 5,
        baseStats: { ...sword.baseStats, Strength: 2 },
      };
      mockContentEntries(strongSword, weakHighLevelSword);
      const strongItem = mockEquipmentItem(strongSword.id);
      const weakItem = mockEquipmentItem(weakHighLevelSword.id);

      const winners = planEquipmentOptimization(
        buildCharacter(),
        [strongItem, weakItem],
        [{ stat: 'Strength', multiplier: 1 }],
      );

      expect(winners).toEqual([{ item: strongItem, content: strongSword }]);
    });

    it('falls back to the highest level requirement when statPriority is empty', () => {
      const lowLevel = {
        ...sword,
        id: 'low' as EquipmentId,
        levelRequirement: 1,
      };
      const highLevel = {
        ...sword,
        id: 'high' as EquipmentId,
        levelRequirement: 5,
      };
      mockContentEntries(lowLevel, highLevel);
      const lowItem = mockEquipmentItem(lowLevel.id);
      const highItem = mockEquipmentItem(highLevel.id);

      const winners = planEquipmentOptimization(
        buildCharacter(),
        [lowItem, highItem],
        [],
      );

      expect(winners).toEqual([{ item: highItem, content: highLevel }]);
    });

    it('leaves a slot untouched when the currently equipped item already beats every armory candidate', () => {
      const weakSword = {
        ...sword,
        id: 'weak' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 2 },
      };
      const strongEquipped = {
        ...sword,
        id: 'equipped' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 20 },
      };
      mockContentEntries(weakSword, strongEquipped);
      const equippedItem = mockEquipmentItem(strongEquipped.id);
      const armoryItem = mockEquipmentItem(weakSword.id);
      const character = buildCharacter({
        equipment: { ...emptyEquipment, Weapon: equippedItem },
      });

      const winners = planEquipmentOptimization(
        character,
        [armoryItem],
        [{ stat: 'Strength', multiplier: 1 }],
      );

      expect(winners).toEqual([]);
    });

    it('leaves a slot untouched when an armory candidate exactly ties the currently equipped item', () => {
      const tiedSword = {
        ...sword,
        id: 'tied' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 10 },
      };
      const equippedSword = {
        ...sword,
        id: 'equipped' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 10 },
      };
      mockContentEntries(tiedSword, equippedSword);
      const equippedItem = mockEquipmentItem(equippedSword.id);
      const armoryItem = mockEquipmentItem(tiedSword.id);
      const character = buildCharacter({
        equipment: { ...emptyEquipment, Weapon: equippedItem },
      });

      const winners = planEquipmentOptimization(
        character,
        [armoryItem],
        [{ stat: 'Strength', multiplier: 1 }],
      );

      expect(winners).toEqual([]);
    });

    it('prefers a candidate that beats the equipped item on a stat outside statPriority, even when priority stats tie (e.g. Copper Bangle vs. Copper Ring, both 0 on Strength/Vitality/Agility/Resistance)', () => {
      const copperRing = {
        ...sword,
        id: 'copper-ring' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 0, Agility: 0, Energy: 3 },
      };
      const copperBangle = {
        ...sword,
        id: 'copper-bangle' as EquipmentId,
        baseStats: {
          ...sword.baseStats,
          Strength: 0,
          Agility: 0,
          Energy: 3,
          Health: 3,
        },
      };
      mockContentEntries(copperRing, copperBangle);
      const equippedRing = mockEquipmentItem(copperRing.id);
      const armoryBangle = mockEquipmentItem(copperBangle.id);
      const character = buildCharacter({
        equipment: { ...emptyEquipment, Weapon: equippedRing },
      });

      const winners = planEquipmentOptimization(
        character,
        [armoryBangle],
        [
          { stat: 'Strength', multiplier: 1 },
          { stat: 'Vitality', multiplier: 1 },
          { stat: 'Agility', multiplier: 1 },
          { stat: 'Resistance', multiplier: 1 },
        ],
      );

      expect(winners).toEqual([{ item: armoryBangle, content: copperBangle }]);
    });

    it("claims a two-handed item's secondary slot so nothing separate is chosen for it", () => {
      const shield = {
        ...sword,
        id: 'shield' as EquipmentId,
        type: 'Shield' as const,
      };
      mockContentEntries(spear, shield);
      const spearItem = mockEquipmentItem(spear.id);
      const shieldItem = mockEquipmentItem(shield.id);

      const winners = planEquipmentOptimization(
        buildCharacter(),
        [spearItem, shieldItem],
        [{ stat: 'Strength', multiplier: 1 }],
      );

      expect(winners).toEqual([{ item: spearItem, content: spear }]);
    });

    it('excludes slots unavailable for the character job (e.g. Artifact for a non-Magician)', () => {
      const artifact = {
        ...sword,
        id: 'artifact' as EquipmentId,
        type: 'Artifact' as const,
      };
      mockContentEntries(artifact);
      const artifactItem = mockEquipmentItem(artifact.id);

      const winners = planEquipmentOptimization(
        buildCharacter(),
        [artifactItem],
        [],
      );

      expect(winners).toEqual([]);
    });

    it('excludes candidates the hero cannot currently equip', () => {
      const tooHighLevel = {
        ...sword,
        id: 'too-high' as EquipmentId,
        levelRequirement: 99,
      };
      mockContentEntries(tooHighLevel);
      const item = mockEquipmentItem(tooHighLevel.id);

      const winners = planEquipmentOptimization(
        buildCharacter({ level: 5 }),
        [item],
        [],
      );

      expect(winners).toEqual([]);
    });

    it('prefers a tradeoff candidate whose non-priority stats net positive, even though one of those stats is negative', () => {
      const zeroRing = {
        ...sword,
        id: 'zero-ring' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 0, Agility: 0 },
      };
      const tradeoffBangle = {
        ...sword,
        id: 'tradeoff-bangle' as EquipmentId,
        baseStats: {
          ...sword.baseStats,
          Strength: 0,
          Agility: 0,
          Luck: 10,
          Vitality: -3,
        },
      };
      mockContentEntries(zeroRing, tradeoffBangle);
      const equippedItem = mockEquipmentItem(zeroRing.id);
      const armoryItem = mockEquipmentItem(tradeoffBangle.id);
      const character = buildCharacter({
        equipment: { ...emptyEquipment, Weapon: equippedItem },
      });

      const winners = planEquipmentOptimization(
        character,
        [armoryItem],
        [
          { stat: 'Strength', multiplier: 1 },
          { stat: 'Agility', multiplier: 1 },
        ],
      );

      expect(winners).toEqual([{ item: armoryItem, content: tradeoffBangle }]);
    });

    it('rejects a tradeoff candidate whose non-priority stats net negative overall', () => {
      const zeroRing = {
        ...sword,
        id: 'zero-ring' as EquipmentId,
        baseStats: { ...sword.baseStats, Strength: 0, Agility: 0 },
      };
      const cursedBangle = {
        ...sword,
        id: 'cursed-bangle' as EquipmentId,
        baseStats: {
          ...sword.baseStats,
          Strength: 0,
          Agility: 0,
          Luck: 2,
          Vitality: -5,
        },
      };
      mockContentEntries(zeroRing, cursedBangle);
      const equippedItem = mockEquipmentItem(zeroRing.id);
      const armoryItem = mockEquipmentItem(cursedBangle.id);
      const character = buildCharacter({
        equipment: { ...emptyEquipment, Weapon: equippedItem },
      });

      const winners = planEquipmentOptimization(
        character,
        [armoryItem],
        ['Strength', 'Agility'],
      );

      expect(winners).toEqual([]);
    });
  });

  describe('isSlotAvailableForJob', () => {
    it('is always available for a non-class-exclusive slot', () => {
      expect(isSlotAvailableForJob('Weapon', 'ranger' as JobId)).toBe(true);
      expect(getEntry).not.toHaveBeenCalled();
    });

    it('is available for Artifact only when the job is named Magician', () => {
      vi.mocked(getEntry).mockReturnValue({ name: 'Magician' } as JobContent);
      expect(isSlotAvailableForJob('Artifact', 'magician' as JobId)).toBe(true);

      vi.mocked(getEntry).mockReturnValue({ name: 'Ranger' } as JobContent);
      expect(isSlotAvailableForJob('Artifact', 'ranger' as JobId)).toBe(false);
    });

    it('is available for Ammo only when the job is named Ranger', () => {
      vi.mocked(getEntry).mockReturnValue({ name: 'Ranger' } as JobContent);
      expect(isSlotAvailableForJob('Ammo', 'ranger' as JobId)).toBe(true);

      vi.mocked(getEntry).mockReturnValue({ name: 'Magician' } as JobContent);
      expect(isSlotAvailableForJob('Ammo', 'magician' as JobId)).toBe(false);
    });
  });

  describe('newEquipmentItem', () => {
    const strengthAffix: AffixContent = {
      id: 'affix-str' as AffixId,
      name: 'of Strength',
      __type: 'affix',
      description: '',
      rarity: 'Common',
      family: 'Strength',
      effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
    };

    it('rolls affixes for the resolved content rarity', () => {
      vi.mocked(getEntry).mockReturnValue({
        ...sword,
        rarity: 'Legendary',
      } as never);
      vi.mocked(getEntriesByType).mockReturnValue([strengthAffix] as never);

      const item = newEquipmentItem(sword.id);

      expect(item.equipmentId).toBe(sword.id);
      expect(item.infusedItemIds).toEqual([]);
      expect(item.affixIds).toEqual([strengthAffix.id]);
    });

    it('rolls no affixes when the content cannot be found', () => {
      vi.mocked(getEntry).mockReturnValue(undefined);

      const item = newEquipmentItem(sword.id);
      expect(item.affixIds).toEqual([]);
      expect(getEntriesByType).not.toHaveBeenCalled();
    });
  });

  describe('backfillEquipmentItem', () => {
    it('backfills a missing id and defaults infusedItemIds/affixIds', () => {
      const item = { equipmentId: sword.id } as unknown as EquipmentItem;

      const backfilled = backfillEquipmentItem(item);

      expect(backfilled.id).toBeTruthy();
      expect(backfilled.infusedItemIds).toEqual([]);
      expect(backfilled.affixIds).toEqual([]);
    });
  });

  describe('equipmentAffixEffects', () => {
    const strengthAffix: AffixContent = {
      id: 'affix-str' as AffixId,
      name: 'of Strength',
      __type: 'affix',
      description: '',
      rarity: 'Common',
      family: 'Strength',
      effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
    };

    it('collects affix effects from every distinct equipped item', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === strengthAffix.id ? strengthAffix : undefined) as never,
      );

      const equipment: EquipmentBlock = {
        ...emptyEquipment,
        Weapon: {
          ...mockEquipmentItem(sword.id),
          affixIds: [strengthAffix.id],
        },
      };

      expect(equipmentAffixEffects(equipment)).toEqual(strengthAffix.effects);
    });

    it('counts a two-handed item once even though it occupies two slots', () => {
      vi.mocked(getEntry).mockImplementation(
        (id) => (id === strengthAffix.id ? strengthAffix : undefined) as never,
      );

      const spearItem = {
        ...mockEquipmentItem(spear.id),
        affixIds: [strengthAffix.id],
      };

      const equipment: EquipmentBlock = {
        ...emptyEquipment,
        Weapon: spearItem,
        Offhand: spearItem,
      };

      expect(equipmentAffixEffects(equipment)).toEqual(strengthAffix.effects);
    });

    it('returns an empty array when nothing is equipped', () => {
      expect(equipmentAffixEffects(emptyEquipment)).toEqual([]);
    });
  });
});
