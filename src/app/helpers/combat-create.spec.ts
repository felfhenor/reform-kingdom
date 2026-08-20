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

vi.mock('@helpers/global-effects', () => ({
  activeGlobalEffects: vi.fn(() => []),
}));

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(() => 'rng-id'),
}));

import { combatantFromCharacter, combatantFromMonster } from '@helpers/combat-create';
import { getEntry } from '@helpers/content';
import { activeGlobalEffects } from '@helpers/global-effects';
import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentSkillContent,
  EquipmentSkillId,
  GlobalEffect,
  GlobalEffectId,
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
  family: 'Attack',
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
  statPriority: [],
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
    combatOrders: {},
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

  it('applies active GainStats global effects to statBoosts and totalStats', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        id: 'strength' as GlobalEffectId,
        name: 'Strength of the Duchy I',
        __type: 'globaleffect',
        description: '',
        sprite: '0000',
        startTick: 0,
        expiresAtTick: 100,
        effects: [
          { effectType: 'GainStats', stat: 'Strength', value: 5 },
          { effectType: 'GainStats', stat: 'Vitality', value: 5 },
        ],
      },
    ] as GlobalEffect[]);

    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.statBoosts.Strength).toBe(5);
    expect(combatant.statBoosts.Vitality).toBe(5);
    expect(combatant.totalStats.Strength).toBe(5);
    expect(combatant.totalStats.Vitality).toBe(5);
  });

  it('tops up current hp/ep by a Health/Energy GainStats bonus, even when not at full health', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        id: 'invigoration' as GlobalEffectId,
        name: 'Invigoration of the Zelks I',
        __type: 'globaleffect',
        description: '',
        sprite: '0000',
        startTick: 0,
        expiresAtTick: 100,
        effects: [
          { effectType: 'GainStats', stat: 'Health', value: 25 },
          { effectType: 'GainStats', stat: 'Energy', value: 25 },
        ],
      },
    ] as GlobalEffect[]);

    const combatant = combatantFromCharacter(
      buildCharacter({ hp: 6, ep: 4 }),
    );

    expect(combatant.hp).toBe(31);
    expect(combatant.ep).toBe(29);
    expect(combatant.totalStats.Health).toBe(25);
    expect(combatant.totalStats.Energy).toBe(25);
  });

  it('ignores active GlobalXPGainMultiplier effects when applying stat boosts', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        id: 'wisdom' as GlobalEffectId,
        name: 'Wisdom of the Founder I',
        __type: 'globaleffect',
        description: '',
        sprite: '0000',
        startTick: 0,
        expiresAtTick: 100,
        effects: [{ effectType: 'GlobalXPGainMultiplier', value: 0.1 }],
      },
    ] as GlobalEffect[]);

    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.statBoosts).toEqual(zeroStats());
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
      skills: [{ skillId: snipeSkill.id, weight: 1 }],
    } as MonsterContent;

    const combatant = combatantFromMonster(monster, 1, 0);

    expect(combatant.skillIds).toEqual([snipeSkill.id]);
    expect(getEntry).not.toHaveBeenCalled();
  });

  it('carries each skill weight into skillWeights', () => {
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
      skills: [
        { skillId: attackSkill.id, weight: 1 },
        { skillId: snipeSkill.id, weight: 3 },
      ],
    } as MonsterContent;

    const combatant = combatantFromMonster(monster, 1, 0);

    expect(combatant.skillWeights).toEqual({
      [attackSkill.id]: 1,
      [snipeSkill.id]: 3,
    });
  });

  it('is not affected by active GainStats global effects - those only apply to heroes', () => {
    vi.mocked(activeGlobalEffects).mockReturnValue([
      {
        id: 'strength' as GlobalEffectId,
        name: 'Strength of the Duchy I',
        __type: 'globaleffect',
        description: '',
        sprite: '0000',
        startTick: 0,
        expiresAtTick: 100,
        effects: [{ effectType: 'GainStats', stat: 'Strength', value: 5 }],
      },
    ] as GlobalEffect[]);

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
      skills: [{ skillId: attackSkill.id, weight: 1 }],
    } as MonsterContent;

    const combatant = combatantFromMonster(monster, 1, 0);

    expect(combatant.statBoosts).toEqual(zeroStats());
  });
});
