import type * as RngHelper from '@helpers/rng';
import type {
  Combatant,
  EquipmentSkill,
  EquipmentSkillContentTechnique,
  MonsterId,
  StatusEffectContent,
  StatusEffectId,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return {
    ...actual,
    rngSucceedsChance: vi.fn().mockReturnValue(false),
    // 1 => mitigation roll always lands at the full ceiling, reproducing
    // the old flat-subtraction numbers for the pre-existing defense tests.
    rngUniform: vi.fn().mockReturnValue(1),
  };
});

import { combatApplySkillToTarget } from '@helpers/combat/combat-damage';
import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import {
  combatantMessageToken,
  combatLog,
  combatLogReset,
} from '@helpers/combat/combat-log';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import {
  defaultAffinities,
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import {
  buildCombat,
  buildEquipmentSkill,
  buildTestCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { ensureStatusEffect } from '@helpers/content/ensure-statuseffect';
import { rngSucceedsChance, rngUniform } from '@helpers/rng';

// Fixed id/name/hp and zeroed stats so damage math in each test starts from a clean slate.
function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return buildTestCombatant({ name: 'Combatant', ...overrides });
}

function buildSkill(overrides: Partial<EquipmentSkill> = {}): EquipmentSkill {
  return buildEquipmentSkill({
    name: 'Test Skill',
    family: 'Test Skill',
    ...overrides,
  });
}

function buildTechnique(
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return ensureEquipmentSkillTechnique({
    attributes: ['DamagesTarget'],
    combatMessage: '',
    ...overrides,
  });
}

beforeEach(() => {
  vi.mocked(rngSucceedsChance).mockClear().mockReturnValue(false);
  vi.mocked(rngUniform).mockClear().mockReturnValue(1);
});

describe('combatApplySkillToTarget healing', () => {
  it("reduces a heal by the target's healingIgnorePercent, treated as a 0-100 percent (not a raw fraction)", () => {
    const attacker = buildCombatant({
      totalStats: { ...defaultStats(), Health: 100, Strength: 100 },
    });
    const target = buildCombatant({
      hp: 0,
      totalStats: { ...defaultStats(), Health: 10000 },
      combatStats: { ...defaultCombatStats(), healingIgnorePercent: 20 },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...defaultStats(), Strength: 1 },
      attributes: ['HealsTarget', 'NeverMisses', 'BypassDefense'],
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 1 = 100, reduced by 20% -> heals for 80.
    expect(target.hp).toBe(80);
  });
});

describe('combatApplySkillToTarget energy restore', () => {
  function restore(ep: number): Combatant {
    combatantDamageEvents.set([]);
    const caster = buildCombatant({
      hp: 50,
      ep,
      totalStats: {
        ...defaultStats(),
        Health: 100,
        Energy: 100,
        Intelligence: 30,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [caster] }),
      caster,
      caster,
      buildSkill(),
      buildTechnique({
        damageScaling: { ...defaultStats(), Intelligence: 1 },
        attributes: ['BypassDefense', 'NeverMisses', 'RestoresTargetEnergy'],
      }),
    );

    return caster;
  }

  it('restores EP without touching HP and emits only an energy event', () => {
    const caster = restore(10);

    expect(caster.ep).toBe(40);
    expect(caster.hp).toBe(50);
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: caster.id, amount: 30, variant: 'energy' },
    ]);
  });

  it('caps the restore at missing EP', () => {
    const caster = restore(90);

    expect(caster.ep).toBe(100);
    expect(combatantDamageEvents()).toMatchObject([{ amount: 10 }]);
  });
});

describe('combatApplySkillToTarget defense', () => {
  it('mitigates a purely physical technique using only the target Vitality stat', () => {
    const attacker = buildCombatant({
      totalStats: { ...defaultStats(), Health: 100, Strength: 100 },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        ...defaultStats(),
        Health: 1000,
        Resistance: 100,
        Vitality: 20,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...defaultStats(), Strength: 1 },
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
      totalStats: { ...defaultStats(), Health: 100, Intelligence: 100 },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        ...defaultStats(),
        Health: 1000,
        Resistance: 20,
        Vitality: 100,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...defaultStats(), Intelligence: 1 },
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
        ...defaultStats(),
        Health: 100,
        Intelligence: 100,
        Strength: 100,
      },
    });
    const target = buildCombatant({
      totalStats: {
        ...defaultStats(),
        Health: 100,
        Resistance: 100,
        Vitality: 300,
      },
    });
    const skill = buildSkill();
    // 75% Strength / 25% Intelligence -> defense should be
    // 0.75 * Vitality(300) + 0.25 * Resistance(100) = 250.
    const technique = buildTechnique({
      damageScaling: { ...defaultStats(), Intelligence: 0.25, Strength: 0.75 },
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

describe('combatApplySkillToTarget mitigation roll', () => {
  function buildRollScenario(targetLuck: number) {
    const attacker = buildCombatant({
      totalStats: { ...defaultStats(), Health: 100, Strength: 100 },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        ...defaultStats(),
        Health: 1000,
        Luck: targetLuck,
        Vitality: 40,
      },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...defaultStats(), Strength: 1 },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 1 = 100; ceiling = Vitality(40).
    return target.hp;
  }

  it('rolls below the flat ceiling when rngUniform is below 1', () => {
    vi.mocked(rngUniform).mockReturnValue(0.5);

    // diceEquivalent at 0 Luck = 2, so rolled defense = 40 * 0.5^(1/2) ≈ 28.28.
    const hp = buildRollScenario(0);

    expect(hp).toBe(1000 - Math.floor(100 - 40 * 0.5 ** (1 / 2)));
  });

  it('raises the rolled defense as target Luck increases, for the same roll', () => {
    vi.mocked(rngUniform).mockReturnValue(0.5);

    const hpAtZeroLuck = buildRollScenario(0);
    const hpAtHighLuck = buildRollScenario(50);

    // Same rngUniform draw, but 50 Luck (diceEquivalent 7) skews closer to
    // the ceiling than 0 Luck (diceEquivalent 2) - higher HP remaining.
    expect(hpAtHighLuck).toBeGreaterThan(hpAtZeroLuck);
  });
});

describe('combatApplySkillToTarget critical hit event', () => {
  function applyStrengthHit(): Combatant {
    const attacker = buildCombatant({
      totalStats: { ...buildCombatant().totalStats!, Strength: 100 },
    });
    const target = buildCombatant({
      id: 'target-1',
      hp: 1000,
      totalStats: { ...buildCombatant().totalStats!, Health: 1000 },
    });
    const technique = buildTechnique({
      damageScaling: {
        ...buildTechnique().damageScaling,
        Strength: 1,
      },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill(),
      technique,
    );

    return target;
  }

  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('tags the damage event as critical and doubles the damage when the luck roll succeeds', () => {
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(true);

    const target = applyStrengthHit();

    expect(target.hp).toBe(1000 - 200);
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: 'target-1', amount: -200, variant: 'critical' },
    ]);
  });

  it('leaves the damage event untagged when the luck roll fails', () => {
    const target = applyStrengthHit();

    expect(target.hp).toBe(1000 - 100);
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: 'target-1', amount: -100 },
    ]);
    expect(combatantDamageEvents()[0].variant).toBeUndefined();
  });
});

describe('combatApplySkillToTarget damage reflect', () => {
  function hitReflectingTarget(
    attributes: EquipmentSkillContentTechnique['attributes'],
  ): Combatant {
    const attacker = buildCombatant({
      hp: 1000,
      totalStats: {
        ...buildCombatant().totalStats!,
        Health: 1000,
        Strength: 100,
      },
    });
    const target = buildCombatant({
      id: 'target-1',
      hp: 1000,
      totalStats: { ...buildCombatant().totalStats!, Health: 1000 },
      combatStats: { ...defaultCombatStats(), damageReflectPercent: 50 },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill(),
      buildTechnique({
        attributes,
        damageScaling: { ...buildTechnique().damageScaling, Strength: 1 },
      }),
    );

    return attacker;
  }

  it('reflects a percent of the damage back at the attacker for a CanBeReflected technique', () => {
    expect(hitReflectingTarget(['DamagesTarget', 'CanBeReflected']).hp).toBe(
      1000 - 50,
    );
  });

  it('does not reflect a technique without CanBeReflected', () => {
    expect(hitReflectingTarget(['DamagesTarget']).hp).toBe(1000);
  });
});

describe('combatApplySkillToTarget block and dodge events', () => {
  const zeroStats = () => buildCombatant().totalStats!;
  const strengthScaling = () => ({
    ...buildTechnique().damageScaling,
    Strength: 1,
  });

  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('emits a block event when defense absorbs the whole hit', () => {
    const attacker = buildCombatant({
      totalStats: { ...zeroStats(), Strength: 30 },
    });
    const target = buildCombatant({
      id: 'target-1',
      hp: 1000,
      totalStats: { ...zeroStats(), Health: 1000, Vitality: 50 },
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill(),
      buildTechnique({ damageScaling: strengthScaling() }),
    );

    expect(target.hp).toBe(1000);
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: 'target-1', amount: 0, variant: 'block' },
    ]);
  });

  it('does not emit a block event when a technique never had damage to deal', () => {
    const attacker = buildCombatant();
    const target = buildCombatant({ id: 'target-1', hp: 1000 });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill(),
      buildTechnique(),
    );

    expect(combatantDamageEvents()).toHaveLength(0);
  });

  it('emits a miss event on the target when it luck-dodges the technique', () => {
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(true);
    const attacker = buildCombatant({
      totalStats: { ...zeroStats(), Strength: 100 },
    });
    const target = buildCombatant({ id: 'target-1', hp: 1000 });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill(),
      buildTechnique({
        attributes: ['DamagesTarget', 'AllowLuckDodge'],
        damageScaling: strengthScaling(),
      }),
    );

    expect(target.hp).toBe(1000);
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: 'target-1', amount: 0, variant: 'miss' },
    ]);
  });
});

describe('combatApplySkillToTarget status effect resistance', () => {
  const stunEffect: StatusEffectContent = ensureStatusEffect({
    id: 'stun-effect' as StatusEffectId,
    name: 'Test Stun',
    effectType: 'Debuff',
    tags: ['Stun'],
  });

  beforeEach(() => {
    seedContent([stunEffect]);
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
      tagResistance: { ...defaultTagResistances(), Stun: 25 },
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
      tagResistance: { ...defaultTagResistances(), Stun: 25 },
    });
    runWithStunTechnique(target);

    expect(target.statusEffects).toHaveLength(1);
    // A 3rd call happens once the effect is actually applied - the
    // pre-existing, unrelated `debuffIgnoreChance` full-negation roll
    // (0% here, so it doesn't fire).
    expect(rngSucceedsChance).toHaveBeenCalledTimes(3);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(1, 60);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(2, 25);
  });

  it("skips the gear roll entirely when the target has no resistance to the effect's tags", () => {
    vi.mocked(rngSucceedsChance).mockReturnValueOnce(true); // LUK roll: not resisted

    const target = buildCombatant({
      id: 'target',
      tagResistance: { ...defaultTagResistances(), Stun: 0 },
    });
    runWithStunTechnique(target);

    expect(target.statusEffects).toHaveLength(1);
    // Only 2 calls, not 3 - proves the gear roll was skipped, leaving just
    // the LUK roll plus the unrelated downstream `debuffIgnoreChance` roll.
    expect(rngSucceedsChance).toHaveBeenCalledTimes(2);
    expect(rngSucceedsChance).toHaveBeenNthCalledWith(1, 60);
  });
});

describe('combatApplySkillToTarget combat message rendering', () => {
  beforeEach(() => {
    combatLogReset();
  });

  it('embeds combatant/target id tokens (not raw names) and reflects post-damage HP', () => {
    const zeroStats = defaultStats();
    const attacker = buildCombatant({
      id: 'attacker',
      name: 'Jala',
      totalStats: { ...zeroStats, Strength: 30 },
    });
    const target = buildCombatant({
      id: 'target',
      name: 'Goblin',
      hp: 100,
      totalStats: { ...zeroStats, Health: 100 },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...zeroStats, Strength: 1 },
      combatMessage:
        '**{{ combatant.name }}** hits **{{ target.name }}** for {{ damage }} damage ({{ target.hp }}/{{ target.totalStats.Health }} HP remaining).',
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // Proves the id tokens (not raw names) are embedded, that target.hp
    // reflects the just-applied damage rather than a stale pre-damage snapshot,
    // and that each bolded id token got its icon token hoisted in front of it.
    expect(combatLog()[0].message).toBe(
      `@@icon-attacker@@**${combatantMessageToken(attacker)}** hits @@icon-target@@**${combatantMessageToken(target)}** for 30 damage (70/100 HP remaining).`,
    );
  });
});

describe('combatApplySkillToTarget monster type damage bonus', () => {
  const zeroStats = defaultStats();

  it("boosts damage by the attacker's MonsterTypeDamage affix bonus when it matches one of the target's monster types", () => {
    seedContent([
      ensureMonster({ id: 'demon-1' as MonsterId, types: ['Demon'] }),
    ]);

    const attacker = buildCombatant({
      totalStats: { ...zeroStats, Strength: 100 },
      monsterTypeDamageBonus: { Demon: 20 },
    });
    const target = buildCombatant({
      hp: 1000,
      monsterId: 'demon-1',
      totalStats: { ...zeroStats, Health: 1000 },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...zeroStats, Strength: 1 },
      attributes: ['DamagesTarget', 'BypassDefense'],
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    // baseDamage = Strength(100) * 1 = 100, boosted 20% for the Demon match -> 120.
    expect(target.hp).toBe(1000 - 120);
  });

  it('leaves damage unmodified when none of the bonus types match the target', () => {
    seedContent([
      ensureMonster({ id: 'beast-1' as MonsterId, types: ['Beast'] }),
    ]);

    const attacker = buildCombatant({
      totalStats: { ...zeroStats, Strength: 100 },
      monsterTypeDamageBonus: { Demon: 20 },
    });
    const target = buildCombatant({
      hp: 1000,
      monsterId: 'beast-1',
      totalStats: { ...zeroStats, Health: 1000 },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...zeroStats, Strength: 1 },
      attributes: ['DamagesTarget', 'BypassDefense'],
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    expect(target.hp).toBe(1000 - 100);
  });

  it('leaves damage unmodified against a target with no monsterId (e.g. a hero)', () => {
    const attacker = buildCombatant({
      totalStats: { ...zeroStats, Strength: 100 },
      monsterTypeDamageBonus: { Demon: 20 },
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: { ...zeroStats, Health: 1000 },
    });
    const skill = buildSkill();
    const technique = buildTechnique({
      damageScaling: { ...zeroStats, Strength: 1 },
      attributes: ['DamagesTarget', 'BypassDefense'],
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      skill,
      technique,
    );

    expect(target.hp).toBe(1000 - 100);
  });
});

describe('combatApplySkillToTarget skill stat bonuses', () => {
  beforeEach(() => {
    vi.mocked(rngUniform).mockReturnValue(1);
  });

  const zeroStats = defaultStats();

  function castFireball(
    attacker: Combatant,
    target: Combatant,
    attributes: EquipmentSkillContentTechnique['attributes'],
  ) {
    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill({ family: 'Fireball' }),
      buildTechnique({
        damageScaling: { ...zeroStats, Intelligence: 1 },
        attributes,
      }),
    );
  }

  it('adds damage from a bonus stat the technique did not scale off', () => {
    const attacker = buildCombatant({
      totalStats: { ...zeroStats, Intelligence: 100, Vitality: 50 },
      skillStatBonuses: [
        { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
      ],
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: { ...zeroStats, Health: 1000 },
    });

    castFireball(attacker, target, ['DamagesTarget', 'BypassDefense']);

    // Intelligence(100) * 1 + Vitality(50) * 2 = 200.
    expect(target.hp).toBe(1000 - 200);
  });

  it('ignores bonuses granted to a different skill family', () => {
    const attacker = buildCombatant({
      totalStats: { ...zeroStats, Intelligence: 100, Vitality: 50 },
      skillStatBonuses: [{ skillFamily: 'Snipe', stat: 'Vitality', value: 2 }],
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: { ...zeroStats, Health: 1000 },
    });

    castFireball(attacker, target, ['DamagesTarget', 'BypassDefense']);

    expect(target.hp).toBe(1000 - 100);
  });

  it('keeps mitigating against the base technique, so a physical-stat bonus does not shift a magic skill onto Vitality', () => {
    const attacker = buildCombatant({
      totalStats: { ...zeroStats, Intelligence: 100, Vitality: 100 },
      skillStatBonuses: [
        { skillFamily: 'Fireball', stat: 'Vitality', value: 1 },
      ],
    });
    const target = buildCombatant({
      hp: 1000,
      totalStats: {
        ...zeroStats,
        Health: 1000,
        Resistance: 50,
        Vitality: 1000,
      },
    });

    castFireball(attacker, target, ['DamagesTarget']);

    // baseDamage 200; the technique is Intelligence-only, so defense is Resistance(50), not a Vitality blend.
    expect(target.hp).toBe(1000 - 150);
  });
});

describe('combatApplySkillToTarget elemental damage', () => {
  const zeroStats = defaultStats();

  beforeEach(() => {
    combatLogReset();
  });

  function hit(
    attackerOverrides: Partial<Combatant>,
    targetOverrides: Partial<Combatant>,
    techniqueOverrides: Partial<EquipmentSkillContentTechnique>,
  ): Combatant {
    const attacker = buildCombatant({
      id: 'attacker',
      totalStats: { ...zeroStats, Strength: 100 },
      ...attackerOverrides,
    });
    const target = buildCombatant({
      id: 'target',
      hp: 1000,
      totalStats: { ...zeroStats, Health: 1000 },
      ...targetOverrides,
    });

    combatApplySkillToTarget(
      buildCombat({ heroes: [attacker], guardians: [target] }),
      attacker,
      target,
      buildSkill(),
      buildTechnique({
        damageScaling: { ...zeroStats, Strength: 1 },
        attributes: ['DamagesTarget', 'BypassDefense'],
        combatMessage: '{{ damageText }}',
        ...techniqueOverrides,
      }),
    );

    return target;
  }

  it("reduces a Fire hit by the target's Fire resistance and names the element", () => {
    const target = hit(
      {},
      { resistance: { ...defaultAffinities(), Fire: 50 } },
      { elements: ['Fire'] },
    );

    expect(target.hp).toBe(1000 - 50);
    expect(combatLog()[0].message).toBe('50 Fire damage');
  });

  it('amplifies a hit against a weakness and applies the attacker boon', () => {
    const target = hit(
      { affinity: { ...defaultAffinities(), Water: 20 } },
      { resistance: { ...defaultAffinities(), Water: -50 } },
      { elements: ['Water'] },
    );

    // 100 * 1.2 boon * 1.5 weakness.
    expect(target.hp).toBe(1000 - 180);
  });

  it('gives a non-elemental technique the attacker gear element', () => {
    const target = hit(
      { gearElements: ['Fire'] },
      { resistance: { ...defaultAffinities(), Fire: 50 } },
      { elements: [] },
    );

    expect(target.hp).toBe(1000 - 50);
    expect(combatLog()[0].message).toBe('50 Fire damage');
  });

  it('still plinks 1 damage through heavy resistance', () => {
    const target = hit(
      { totalStats: { ...zeroStats, Strength: 1 } },
      { resistance: { ...defaultAffinities(), Fire: 75 } },
      {
        elements: ['Fire'],
        attributes: ['DamagesTarget', 'BypassDefense', 'AllowPlink'],
      },
    );

    expect(target.hp).toBe(1000 - 1);
  });

  it('leaves heals untouched by elemental boon/resistance', () => {
    const target = hit(
      { affinity: { ...defaultAffinities(), Water: 100 } },
      {
        hp: 500,
        resistance: { ...defaultAffinities(), Water: 75 },
      },
      {
        elements: ['Water'],
        attributes: ['HealsTarget', 'BypassDefense'],
      },
    );

    expect(target.hp).toBe(600);
  });

  it('renders damageText for a fully-blocked hit', () => {
    hit(
      {},
      { totalStats: { ...zeroStats, Health: 1000, Vitality: 1000 } },
      { elements: ['Fire'], attributes: ['DamagesTarget'] },
    );

    expect(combatLog()[0].message).toBe('0 Fire damage');
  });
});
