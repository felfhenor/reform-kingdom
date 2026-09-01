vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantCombatStatValue,
  combatStatsForCharacterEquipment,
} from '@helpers/combat/combat-stats';
import { defaultCombatStats } from '@helpers/defaults';
import { rngSucceedsChance } from '@helpers/rng';
import type {
  Combatant,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItemId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', () => ({
  rngSucceedsChance: vi.fn(),
}));

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

describe('combatStatsForCharacterEquipment', () => {
  it('returns default combat stats when nothing is equipped', () => {
    expect(combatStatsForCharacterEquipment(emptyEquipment)).toEqual(
      defaultCombatStats(),
    );
  });

  it("adds an equipped item's combatStats bonus on top of the default value", () => {
    const reflectiveSword: EquipmentContent = {
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
        Strength: 0,
        Vitality: 0,
        Resistance: 0,
        Agility: 0,
      },
      combatStats: { ...defaultCombatStats(), damageReflectPercent: 10 },
      type: 'Sword',
      slots: 0,
    };
    vi.mocked(getEntry).mockReturnValue(reflectiveSword);

    const stats = combatStatsForCharacterEquipment({
      ...emptyEquipment,
      Weapon: {
        id: 'sword-1' as EquipmentItemId,
        equipmentId: reflectiveSword.id,
        infusedItemIds: [],
        affixIds: [],
      },
    });

    expect(stats.damageReflectPercent).toBe(10);
  });
});

describe('combatCombatantCombatStatValue', () => {
  it("returns the combatant's raw value for the given stat", () => {
    const combatant = {
      combatStats: { ...defaultCombatStats(), agroValue: 25 },
    } as Combatant;

    expect(combatCombatantCombatStatValue(combatant, 'agroValue')).toBe(25);
  });
});

describe('combatCombatantCombatStatSucceedsChance', () => {
  it("rolls the combatant's value for the given stat through rngSucceedsChance", () => {
    vi.mocked(rngSucceedsChance).mockReturnValue(true);
    const combatant = {
      combatStats: { ...defaultCombatStats(), stunChance: 40 },
    } as Combatant;

    expect(
      combatCombatantCombatStatSucceedsChance(combatant, 'stunChance'),
    ).toBe(true);
    expect(rngSucceedsChance).toHaveBeenCalledWith(40);
  });
});
