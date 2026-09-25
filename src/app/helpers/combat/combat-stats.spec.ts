vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/kingdom/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
  worldCombatState: vi.fn(),
}));

import {
  combatCombatantCombatStatSucceedsChance,
  combatCombatantCombatStatValue,
  combatStatsForCharacter,
} from '@helpers/combat/combat-stats';
import { getEntry } from '@helpers/content/content';
import { defaultCombatStats } from '@helpers/defaults';
import { rngSucceedsChance } from '@helpers/rng';
import type {
  Character,
  Combatant,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItemId,
  JobId,
  TrainerTeachingContent,
  TrainerTeachingId,
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

const WARRIOR = 'job-warrior' as JobId;

function hero(
  equipment: EquipmentBlock,
  teachings: Character['teachings'] = {},
): Character {
  return { jobId: WARRIOR, equipment, teachings } as unknown as Character;
}

describe('combatStatsForCharacter', () => {
  it('returns default combat stats when nothing is equipped', () => {
    expect(combatStatsForCharacter(hero(emptyEquipment))).toEqual(
      defaultCombatStats(),
    );
  });

  it('adds teaching combat stats learned under any job', () => {
    const teaching = {
      id: 'reflect' as TrainerTeachingId,
      effects: [{ kind: 'CombatStat', stat: 'damageReflectPercent', value: 1 }],
    } as TrainerTeachingContent;
    vi.mocked(getEntry).mockReturnValue(teaching);

    const current = combatStatsForCharacter(
      hero(emptyEquipment, { [WARRIOR]: [teaching.id] }),
    );
    const other = combatStatsForCharacter(
      hero(emptyEquipment, { ['job-ranger' as JobId]: [teaching.id] }),
    );

    expect(current.damageReflectPercent).toBe(1);
    expect(other.damageReflectPercent).toBe(1);
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
        Constitution: 0,
        Spirit: 0,
      },
      combatStats: { ...defaultCombatStats(), damageReflectPercent: 10 },
      type: 'Sword',
      slots: 0,
      grantedSkillIds: [],
    };
    vi.mocked(getEntry).mockReturnValue(reflectiveSword);

    const stats = combatStatsForCharacter(
      hero({
        ...emptyEquipment,
        Weapon: {
          id: 'sword-1' as EquipmentItemId,
          equipmentId: reflectiveSword.id,
          infusedItemIds: [],
          affixIds: [],
        },
      }),
    );

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
