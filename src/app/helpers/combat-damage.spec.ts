import type * as RngHelper from '@helpers/rng';
import type {
  Combat,
  Combatant,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
  StatusEffectContent,
  StatusEffectId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({ getEntry: vi.fn() }));

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngSucceedsChance: vi.fn().mockReturnValue(false) };
});

import {
  combatApplySkillToTarget,
  combatCombatantTakeDamage,
} from '@helpers/combat-damage';
import { combatantDamageEvents } from '@helpers/combat-damage-events';
import { getEntry } from '@helpers/content';
import { rngSucceedsChance } from '@helpers/rng';

function buildCombat(overrides: Partial<Combat> = {}): Combat {
  return {
    id: 'combat-1' as never,
    locationName: 'Field Ruins',
    locationPosition: { x: 0, y: 0 },
    rounds: 1,
    heroes: [],
    guardians: [],
    ...overrides,
  };
}

function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'combatant-1',
    name: 'Combatant',
    isEnemy: false,
    level: 1,
    hp: 100,
    ep: 10,
    sprite: '0000',
    frames: 4,
    targettingType: 'Random',
    baseStats: {} as never,
    statBoosts: {} as never,
    totalStats: {
      Agility: 0,
      Energy: 0,
      Health: 100,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    combatStats: {
      repeatActionChance: 0,
      skillStrikeAgainChance: 0,
      skillAdditionalUseChance: 0,
      skillAdditionalUseCount: 0,
      redirectionChance: 0,
      missChance: 0,
      debuffIgnoreChance: 0,
      damageReflectPercent: 0,
      healingIgnorePercent: 0,
      reviveChance: 0,
      stunChance: 0,
    },
    resistance: {} as never,
    affinity: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
    tagResistance: {} as never,
    skillIds: [],
    skillRefs: [],
    skillWeights: {},
    combatOrders: [],
    skillUses: {},
    statusEffects: [],
    statusEffectData: {},
    ...overrides,
  };
}

function buildSkill(overrides: Partial<EquipmentSkill> = {}): EquipmentSkill {
  return {
    id: 'skill-1' as never,
    name: 'Test Skill',
    __type: 'skill',
    description: '',
    sprite: '0000',
    rarity: 'Common',
    epCost: 0,
    usesPerCombat: -1,
    statusEffectDurationBoost: {} as never,
    statusEffectChanceBoost: {} as never,
    techniques: [],
    requiredWeaponTypes: [],
    family: 'Test Skill',
    ...overrides,
  };
}

function buildTechnique(
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return {
    targets: 1,
    targetType: 'Enemies',
    targetBehaviors: [],
    damageScaling: {
      Agility: 0,
      Energy: 0,
      Health: 0,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    elements: [],
    attributes: ['DamagesTarget'],
    statusEffects: [],
    combatMessage: '',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(rngSucceedsChance).mockClear();
  vi.mocked(getEntry).mockClear();
});

describe('combatApplySkillToTarget defense', () => {
  it('mitigates a purely physical technique using only the target Vitality stat', () => {
    const attacker = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 0,
        Luck: 0,
        Resistance: 0,
        Strength: 100,
        Vitality: 0,
      },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 1000,
        Intelligence: 0,
        Luck: 0,
        Resistance: 100,
        Strength: 0,
        Vitality: 20,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0,
        Luck: 0,
        Resistance: 0,
        Strength: 1,
        Vitality: 0,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 1 = 100; defended purely by
    // Vitality (20), never by the target's much larger Resistance (100).
    expect(target.hp).toBe(1000 - (100 - 20));
  });

  it('mitigates a purely magical technique using only the target Resistance stat', () => {
    const attacker = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 100,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 1000,
        Intelligence: 0,
        Luck: 0,
        Resistance: 20,
        Strength: 0,
        Vitality: 100,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 1,
        Luck: 0,
        Resistance: 0,
        Strength: 0,
        Vitality: 0,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Intelligence(100) * 1 = 100; defended purely by
    // Resistance (20), never by the target's much larger Vitality (100).
    expect(target.hp).toBe(1000 - (100 - 20));
  });

  it('splits mitigation between Resistance and Vitality proportional to the damageScaling weights', () => {
    const attacker = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 100,
        Luck: 0,
        Resistance: 0,
        Strength: 100,
        Vitality: 0,
      },
    });
    const target = buildCombatant({
      totalStats: {
        Agility: 0,
        Energy: 0,
        Health: 100,
        Intelligence: 0,
        Luck: 0,
        Resistance: 100,
        Strength: 0,
        Vitality: 300,
      },
    });
    const skill = buildSkill();
    // 75% Strength / 25% Intelligence -> defense should be
    // 0.75 * Vitality(300) + 0.25 * Resistance(100) = 250.
    const technique = buildTechnique({
      damageScaling: {
        Agility: 0,
        Energy: 0,
        Health: 0,
        Intelligence: 0.25,
        Luck: 0,
        Resistance: 0,
        Strength: 0.75,
        Vitality: 0,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 0.75 + Intelligence(100) * 0.25 = 100;
    // fully absorbed by defense (250), so no damage gets through.
    expect(target.hp).toBe(100 - Math.max(0, 100 - 250));
  });
});

describe('combatCombatantTakeDamage', () => {
  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('emits a damage event with the sign flipped for a hero taking damage', () => {
    const hero = buildCombatant({ isEnemy: false, hp: 100 });

    combatCombatantTakeDamage(hero, 25);

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: hero.id, amount: -25 },
    ]);
  });

  it('emits a positive amount for a hero being healed', () => {
    const hero = buildCombatant({ isEnemy: false, hp: 50 });

    combatCombatantTakeDamage(hero, -25);

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: hero.id, amount: 25 },
    ]);
  });

  it('emits a damage event for an enemy combatant too', () => {
    const enemy = buildCombatant({ isEnemy: true, hp: 100 });

    combatCombatantTakeDamage(enemy, 25);

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: enemy.id, amount: -25 },
    ]);
  });

  it('does not emit an event when the amount is zero', () => {
    const hero = buildCombatant({ isEnemy: false, hp: 100 });

    combatCombatantTakeDamage(hero, 0);

    expect(combatantDamageEvents()).toHaveLength(0);
  });
});

describe('combatApplySkillToTarget status effect resistance', () => {
  const stunEffect: StatusEffectContent = {
    id: 'stun-effect' as StatusEffectId,
    name: 'Test Stun',
    __type: 'statuseffect',
    effectType: 'Debuff',
    elements: [],
    tags: ['Stun'],
    trigger: 'TurnStart',
    onApply: [],
    onTick: [],
    onUnapply: [],
    statScaling: {
      Agility: 0,
      Energy: 0,
      Health: 0,
      Intelligence: 0,
      Luck: 0,
      Resistance: 0,
      Strength: 0,
      Vitality: 0,
    },
    useTargetStats: false,
  };

  beforeEach(() => {
    vi.mocked(getEntry).mockReturnValue(stunEffect as never);
  });

  function runWithStunTechnique(target: Combatant): Combatant {
    const attacker = buildCombatant({ id: 'attacker' });
    const skill = buildSkill();
    // damageScaling all zero -> baseDamage is 0, so no crit/dodge roll
    // happens before the status effect block - rngSucceedsChance calls
    // below come only from the resist rolls under test.
    const technique = buildTechnique({
      statusEffects: [
        { statusEffectId: stunEffect.id, chance: 60, duration: 3 },
      ],
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    return target;
  }

  it('resists via LUK alone - the gear roll never runs', () => {
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(false);

    const target = buildCombatant({ id: 'target' });
    runWithStunTechnique(target);

    expect(target.statusEffects).toHaveLength(0);
    expect(rngSucceedsChance).toHaveBeenCalledTimes(1);
    expect(rngSucceedsChance).toHaveBeenCalledWith(60);
  });

  it('resists via gear after the LUK roll already succeeded - two independent rolls', () => {
    vi.mocked(rngSucceedsChance)
      .mockReturnValueOnce(true) // LUK roll: not resisted
      .mockReturnValueOnce(true); // gear roll: resisted

    const target = buildCombatant({
      id: 'target',
      tagResistance: { Stun: 25 } as never,
    });
    runWithStunTechnique(target);

    expect(target.statusEffects).toHaveLength(0);
    expect(rngSucceedsChance).toHaveBeenCalledTimes(2);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(1, 60);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(2, 25);
  });

  it('applies the effect when neither roll resists it', () => {
    vi.mocked(rngSucceedsChance)
      .mockReturnValueOnce(true) // LUK roll: not resisted
      .mockReturnValueOnce(false); // gear roll: not resisted

    const target = buildCombatant({
      id: 'target',
      tagResistance: { Stun: 25 } as never,
    });
    runWithStunTechnique(target);

    expect(target.statusEffects).toHaveLength(1);
    // A 3rd call happens once the effect is actually applied - the
    // pre-existing, unrelated `debuffIgnoreChance` full-negation roll in
    // `combatApplyStatusEffectToTarget` (0% here, so it doesn't fire).
    expect(rngSucceedsChance).toHaveBeenCalledTimes(3);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(1, 60);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(2, 25);
  });

  it('skips the gear roll entirely when the target has no resistance to the effect\'s tags', () => {
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(true); // LUK roll: not resisted

    const target = buildCombatant({
      id: 'target',
      tagResistance: { Stun: 0 } as never,
    });
    runWithStunTechnique(target);

    expect(target.statusEffects).toHaveLength(1);
    // Only 2 calls, not 3 - proves the gear roll (guarded by
    // `tagResistance > 0`) was skipped, leaving just the LUK roll plus the
    // unrelated downstream `debuffIgnoreChance` roll.
    expect(rngSucceedsChance).toHaveBeenCalledTimes(2);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(1, 60);
  });
});
