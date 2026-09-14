import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/kingdom/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/combat/combat', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/combat/combat-state', () => ({
  currentCombat: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/hero/global-effects', () => ({
  globalEffectSums: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(() => 'rng-id'),
}));

import {
  combatantFromCharacter,
  combatantFromMonster,
  combatantsFromTownGuardians,
} from '@helpers/combat/combat-create';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { getEntry } from '@helpers/content/content';
import { defaultCombatStats, defaultTagResistances } from '@helpers/defaults';
import { globalEffectSums } from '@helpers/hero/global-effects';
import type {
  Character,
  CharacterId,
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItemId,
  EquipmentSkillContent,
  EquipmentSkillId,
  GlobalEffectSums,
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
    Constitution: 0,
    Spirit: 0,
  };
}

function zeroGlobalEffectSums(): GlobalEffectSums {
  return {
    stats: zeroStats(),
    combatStats: defaultCombatStats(),
    debuffResistanceTags: defaultTagResistances(),
    debuffResistanceFlat: 0,
    xpGainMultiplierBonus: 0,
    goldGainMultiplierBonus: 0,
    combatItemDropRateBoost: 0,
    gatheringItemDropRateBoost: 0,
    armorySizeBoost: 0,
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

const bow: EquipmentContent = ensureEquipment({
  id: 'bow' as EquipmentId,
  name: 'Bow',
  description: '',
  sprite: '0000',
  rarity: 'Common',
  levelRequirement: 1,
  baseStats: zeroStats(),
  type: 'Bow',
});

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
  vi.mocked(globalEffectSums).mockReturnValue(zeroGlobalEffectSums());
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
        equipment: {
          ...emptyEquipment,
          Weapon: {
            id: 'bow-1' as EquipmentItemId,
            equipmentId: bow.id,
            infusedItemIds: [],
            affixIds: [],
          },
        },
      }),
    );

    expect(combatant.skillIds).toEqual(
      expect.arrayContaining([attackSkill.id, snipeSkill.id]),
    );
    expect(combatant.skillIds).toHaveLength(2);
  });

  it('applies active GainStats global effects to statBoosts and totalStats', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      ...zeroGlobalEffectSums(),
      stats: { ...zeroStats(), Strength: 5, Vitality: 5 },
    });

    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.statBoosts.Strength).toBe(5);
    expect(combatant.statBoosts.Vitality).toBe(5);
    expect(combatant.totalStats.Strength).toBe(5);
    expect(combatant.totalStats.Vitality).toBe(5);
  });

  it('tops up current hp/ep by a Health/Energy GainStats bonus, even when not at full health', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      ...zeroGlobalEffectSums(),
      stats: { ...zeroStats(), Health: 25, Energy: 25 },
    });

    const combatant = combatantFromCharacter(buildCharacter({ hp: 6, ep: 4 }));

    expect(combatant.hp).toBe(31);
    expect(combatant.ep).toBe(29);
    expect(combatant.totalStats.Health).toBe(25);
    expect(combatant.totalStats.Energy).toBe(25);
  });

  it('ignores active GlobalXPGainMultiplier effects when applying stat boosts', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      ...zeroGlobalEffectSums(),
      xpGainMultiplierBonus: 0.1,
    });

    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.statBoosts).toEqual(zeroStats());
  });

  it('applies active GainCombatStat global effects to combatStats', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      ...zeroGlobalEffectSums(),
      combatStats: { ...defaultCombatStats(), reviveChance: 2 },
    });

    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.combatStats.reviveChance).toBe(2);
  });

  it('applies active DebuffResistanceTag global effects to only the targeted tag', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      ...zeroGlobalEffectSums(),
      debuffResistanceTags: { ...defaultTagResistances(), Accuracy: 5 },
    });

    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.tagResistance.Accuracy).toBe(5);
    expect(combatant.tagResistance.Stun).toBe(0);
  });

  it('sets jobId from the character so a monster targetting entry can match it', () => {
    const combatant = combatantFromCharacter(buildCharacter());

    expect(combatant.jobId).toBe(rangerJob.id);
  });

  it("adds an equipped item's combatStats bonus on top of the default value", () => {
    const reflectiveBow: EquipmentContent = {
      ...bow,
      combatStats: {
        repeatActionChance: 0,
        skillStrikeAgainChance: 0,
        redirectionChance: 0,
        missChance: 0,
        debuffIgnoreChance: 0,
        damageReflectPercent: 10,
        healingIgnorePercent: 0,
        reviveChance: 0,
        stunChance: 0,
        agroValue: 0,
      },
    };
    vi.mocked(getEntry).mockImplementation((id) => {
      if (id === rangerJob.id) return rangerJob as never;
      if (id === attackSkill.id) return attackSkill as never;
      if (id === snipeSkill.id) return snipeSkill as never;
      if (id === bow.id) return reflectiveBow as never;
      return undefined as never;
    });

    const combatant = combatantFromCharacter(
      buildCharacter({
        equipment: {
          ...emptyEquipment,
          Weapon: {
            id: 'bow-1' as EquipmentItemId,
            equipmentId: bow.id,
            infusedItemIds: [],
            affixIds: [],
          },
        },
      }),
    );

    expect(combatant.combatStats.damageReflectPercent).toBe(10);
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
      targetting: [{ type: 'Random' }],
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
      targetting: [{ type: 'Random' }],
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
    vi.mocked(globalEffectSums).mockReturnValue({
      ...zeroGlobalEffectSums(),
      stats: { ...zeroStats(), Strength: 5 },
    });

    const monster: MonsterContent = {
      id: 'goblin' as MonsterId,
      name: 'Goblin',
      __type: 'monster',
      description: '',
      sprite: '0000',
      frames: 4,
      targetting: [{ type: 'Random' }],
      baseStats: zeroStats(),
      statsPerLevel: zeroStats(),
      combatStats: defaultCombatStats(),
      skills: [{ skillId: attackSkill.id, weight: 1 }],
    } as MonsterContent;

    const combatant = combatantFromMonster(monster, 1, 0);

    expect(combatant.statBoosts).toEqual(zeroStats());
  });

  it('carries the targetting priority list through from the monster content', () => {
    const monster: MonsterContent = {
      id: 'goblin' as MonsterId,
      name: 'Goblin',
      __type: 'monster',
      description: '',
      sprite: '0000',
      frames: 4,
      rarity: 'Common',
      targetting: [{ type: 'Random', jobId: rangerJob.id }, { type: 'Random' }],
      xp: { min: 0, max: 0 },
      drops: [],
      baseStats: zeroStats(),
      statsPerLevel: zeroStats(),
      combatStats: defaultCombatStats(),
      skills: [],
      types: [],
    };

    const combatant = combatantFromMonster(monster, 1, 0);

    expect(combatant.targetting).toEqual([
      { type: 'Random', jobId: rangerJob.id },
      { type: 'Random' },
    ]);
  });
});

describe('combatantsFromTownGuardians', () => {
  const citizen: MonsterContent = {
    id: 'larsian-citizen' as MonsterId,
    name: 'Larsian Citizen',
    __type: 'monster',
    description: '',
    sprite: '0000',
    frames: 4,
    rarity: 'Common',
    targetting: [{ type: 'Random' }],
    baseStats: zeroStats(),
    statsPerLevel: zeroStats(),
    combatStats: defaultCombatStats(),
    skills: [],
    types: [],
    xp: { min: 0, max: 0 },
    drops: [],
  };

  it('spawns one combatant per entry quantity', () => {
    vi.mocked(getEntry).mockReturnValue(citizen as never);

    const combatants = combatantsFromTownGuardians(
      [{ monsterId: citizen.id, quantity: 3 }],
      25,
    );

    expect(combatants).toHaveLength(3);
    expect(combatants.every((c) => c.monsterId === citizen.id)).toBe(true);
  });

  // A helper fighting for the party must have isEnemy overridden, or targeting/turn-order
  // treat it as an enemy of the party it's supposed to be defending.
  it('fights for the party, not the assaulters', () => {
    vi.mocked(getEntry).mockReturnValue(citizen as never);

    const combatants = combatantsFromTownGuardians(
      [{ monsterId: citizen.id, quantity: 2 }],
      25,
    );

    expect(combatants.every((c) => c.isEnemy === false)).toBe(true);
  });

  it('assigns a unique letter suffix across entries, not restarted per entry', () => {
    const guard: MonsterContent = {
      ...citizen,
      id: 'larsian-guard' as MonsterId,
      name: 'Larsian Guard',
    };
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === citizen.id ? citizen : guard) as never,
    );

    const combatants = combatantsFromTownGuardians(
      [
        { monsterId: citizen.id, quantity: 2 },
        { monsterId: guard.id, quantity: 2 },
      ],
      25,
    );

    expect(combatants.map((c) => c.name)).toEqual([
      'Larsian Citizen Lv.25 [A]',
      'Larsian Citizen Lv.25 [B]',
      'Larsian Guard Lv.25 [C]',
      'Larsian Guard Lv.25 [D]',
    ]);
  });

  it('skips an entry whose monster id no longer resolves to content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const combatants = combatantsFromTownGuardians(
      [{ monsterId: citizen.id, quantity: 3 }],
      25,
    );

    expect(combatants).toEqual([]);
  });
});
