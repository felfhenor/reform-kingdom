import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/combat', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(() => 'rng-id'),
}));

import { combatantFromCharacter, combatantFromMonster } from '@helpers/combat-create';
import { getEntry } from '@helpers/content';
import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentSkillContent,
  EquipmentSkillId,
  JobContent,
  JobId,
  MonsterContent,
  MonsterId,
  StatBlock,
} from '@interfaces';

function zeroStats(): StatBlock {
  return {
    Health: 0,
    Energy: 0,
    Luck: 0,
    Intelligence: 0,
    Strength: 0,
    Vitality: 0,
    Resistance: 0,
    Agility: 0,
  };
}

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

const attackSkill: EquipmentSkillContent = {
  id: 'attack' as EquipmentSkillId,
  name: 'Attack',
  __type: 'skill',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  epCost: 0,
  usesPerCombat: -1,
  statusEffectDurationBoost: {},
  statusEffectChanceBoost: {},
  techniques: [],
  requiredWeaponTypes: [],
};

const snipeSkill: EquipmentSkillContent = {
  ...attackSkill,
  id: 'snipe' as EquipmentSkillId,
  name: 'Snipe',
  requiredWeaponTypes: ['Bow'],
};

const bow: EquipmentContent = {
  id: 'bow' as EquipmentId,
  name: 'Bow',
  __type: 'equipment',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: zeroStats(),
  type: 'Bow',
};

const rangerJob: JobContent = {
  id: 'ranger' as JobId,
  name: 'Ranger',
  __type: 'job',
  description: '',
  baseStats: zeroStats(),
  statsPerLevel: zeroStats(),
  sprite: '0000',
  frames: 4,
  equippableTypes: ['Bow'],
  skillPath: [
    {
      pathName: 'Attack',
      levels: [{ level: 1, skillId: attackSkill.id }],
    },
    {
      pathName: 'Snipe',
      levels: [{ level: 1, skillId: snipeSkill.id }],
    },
  ],
};

function buildCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1' as CharacterId,
    name: 'Hero',
    level: 1,
    jobId: rangerJob.id,
    hp: 10,
    ep: 10,
    stats: zeroStats(),
    equipment: emptyEquipment,
    ...overrides,
  } as Character;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('combatantFromCharacter', () => {
  beforeEach(() => {
    vi.mocked(getEntry).mockImplementation((id) => {
      if (id === rangerJob.id) return rangerJob as never;
      if (id === attackSkill.id) return attackSkill as never;
      if (id === snipeSkill.id) return snipeSkill as never;
      if (id === bow.id) return bow as never;
      return undefined as never;
    });
  });

  it('excludes a weapon-gated skill when the required weapon is not equipped', () => {
    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.skillIds).toEqual([attackSkill.id]);
  });

  it('includes a weapon-gated skill once the required weapon is equipped', () => {
    const combatant = combatantFromCharacter(
      buildCharacter({
        equipment: { ...emptyEquipment, Weapon: { equipmentId: bow.id } },
      }),
    );

    expect(combatant.skillIds).toEqual(
      expect.arrayContaining([attackSkill.id, snipeSkill.id]),
    );
    expect(combatant.skillIds).toHaveLength(2);
  });
});

describe('combatantFromMonster', () => {
  it('is unaffected by weapon requirements - monsters keep every listed skill', () => {
    const monster: MonsterContent = {
      id: 'goblin' as MonsterId,
      name: 'Goblin',
      __type: 'monster',
      description: '',
      sprite: '0000',
      frames: 4,
      targettingType: 'Random',
      baseStats: zeroStats(),
      statsPerLevel: zeroStats(),
      skills: [{ skillId: snipeSkill.id }],
    } as MonsterContent;

    const combatant = combatantFromMonster(monster, 1, 0);

    expect(combatant.skillIds).toEqual([snipeSkill.id]);
    expect(getEntry).not.toHaveBeenCalled();
  });
});
