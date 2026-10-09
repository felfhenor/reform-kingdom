import {
  combatOrderConditionMatches,
  matchingCombatantsForCondition,
  pickSkillFromCombatOrders,
  resolveFamilyToSkill,
} from '@helpers/combat/combat-order-evaluation';
import type {
  CharacterId,
  Combatant,
  CombatOrderClauseId,
  CombatOrderCondition,
  EquipmentSkillContentTechnique,
  EquipmentSkillId,
  StatusEffectId,
} from '@interfaces';
import { ensureEquipmentSkillTechnique } from '@helpers/content/ensure-skill';
import {
  buildCombat,
  buildEquipmentSkill,
  buildStatusEffect,
  buildTestCombatant,
} from '@/testing/builders';
import { describe, expect, it } from 'vitest';

function buildTechnique(
  overrides: Partial<EquipmentSkillContentTechnique> = {},
): EquipmentSkillContentTechnique {
  return ensureEquipmentSkillTechnique({
    targetType: 'Allies',
    targetBehaviors: [{ behavior: 'Always' }],
    ...overrides,
  });
}

describe('resolveFamilyToSkill', () => {
  it('finds the available skill matching the given family', () => {
    const cure = buildEquipmentSkill({
      id: 'cure' as EquipmentSkillId,
      family: 'Cure',
    });
    const fireball = buildEquipmentSkill({
      id: 'fireball' as EquipmentSkillId,
      family: 'Fireball',
    });

    expect(resolveFamilyToSkill('Fireball', [cure, fireball])).toBe(fireball);
  });

  it('returns undefined when no available skill matches the family', () => {
    const cure = buildEquipmentSkill({
      id: 'cure' as EquipmentSkillId,
      family: 'Cure',
    });

    expect(resolveFamilyToSkill('Fireball', [cure])).toBeUndefined();
  });
});

describe('combatOrderConditionMatches', () => {
  const combat = buildCombat();

  it('Always always matches', () => {
    expect(
      combatOrderConditionMatches(
        { type: 'Always' },
        combat,
        buildTestCombatant(),
      ),
    ).toBe(true);
  });

  it('SelfHasNoSummon matches until the combatant has a living summon', () => {
    const combatant = buildTestCombatant({ id: 'caster' });
    const summon = buildTestCombatant({ id: 'summon', summonerId: 'caster' });
    const withSummon = buildCombat({ heroes: [combatant], helpers: [summon] });
    const condition: CombatOrderCondition = { type: 'SelfHasNoSummon' };

    expect(combatOrderConditionMatches(condition, combat, combatant)).toBe(
      true,
    );
    expect(combatOrderConditionMatches(condition, withSummon, combatant)).toBe(
      false,
    );

    summon.hp = 0;
    expect(combatOrderConditionMatches(condition, withSummon, combatant)).toBe(
      true,
    );
  });

  it('SelfHealthPercent compares current HP% against the threshold', () => {
    const combatant = buildTestCombatant({
      hp: 50,
    });
    const condition: CombatOrderCondition = {
      type: 'SelfHealthPercent',
      comparator: 'LessThan',
      value: 51,
    };

    expect(combatOrderConditionMatches(condition, combat, combatant)).toBe(
      true,
    );
    expect(
      combatOrderConditionMatches(
        { ...condition, value: 50 },
        combat,
        combatant,
      ),
    ).toBe(false);
    expect(
      combatOrderConditionMatches(
        { ...condition, comparator: 'LessThanOrEqual', value: 50 },
        combat,
        combatant,
      ),
    ).toBe(true);
  });

  it('SelfEnergyPercent compares current EP% against the threshold', () => {
    const combatant = buildTestCombatant({
      ep: 25,
    });

    expect(
      combatOrderConditionMatches(
        { type: 'SelfEnergyPercent', comparator: 'GreaterThan', value: 20 },
        combat,
        combatant,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        { type: 'SelfEnergyPercent', comparator: 'GreaterThan', value: 25 },
        combat,
        combatant,
      ),
    ).toBe(false);
  });

  it('AllyCountHealthPercent (Below) counts the caster as its own ally and excludes the dead', () => {
    const caster = buildTestCombatant({ id: 'caster', hp: 40 });
    const lowHpAlly = buildTestCombatant({ id: 'low', hp: 10 });
    const deadAlly = buildTestCombatant({ id: 'dead', hp: 0 });
    const healthyAlly = buildTestCombatant({ id: 'healthy', hp: 100 });

    const combatWithAllies = buildCombat({
      heroes: [caster, lowHpAlly, deadAlly, healthyAlly],
    });

    // caster (40%) and low (10%) are both below 75%; dead is excluded entirely.
    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Below',
          healthPercent: 75,
          comparator: 'GreaterThanOrEqual',
          count: 2,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Below',
          healthPercent: 75,
          comparator: 'GreaterThanOrEqual',
          count: 3,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(false);
  });

  it('AllyCountHealthPercent counts town-guardian helpers as allies, alongside heroes', () => {
    const caster = buildTestCombatant({ id: 'caster', hp: 40 });
    const lowHpHelper = buildTestCombatant({ id: 'helper-1', hp: 10 });

    const combatWithHelper = buildCombat({
      heroes: [caster],
      helpers: [lowHpHelper],
    });

    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Below',
          healthPercent: 75,
          comparator: 'GreaterThanOrEqual',
          count: 2,
        },
        combatWithHelper,
        caster,
      ),
    ).toBe(true);
  });

  it('AllyCountHealthPercent (Above) counts allies strictly above the threshold', () => {
    const caster = buildTestCombatant({ id: 'caster', hp: 40 });
    const lowHpAlly = buildTestCombatant({ id: 'low', hp: 10 });
    const healthyAlly = buildTestCombatant({ id: 'healthy', hp: 100 });

    const combatWithAllies = buildCombat({
      heroes: [caster, lowHpAlly, healthyAlly],
    });

    // Only healthy (100%) is above 75%.
    expect(
      combatOrderConditionMatches(
        {
          type: 'AllyCountHealthPercent',
          healthDirection: 'Above',
          healthPercent: 75,
          comparator: 'Equal',
          count: 1,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(true);
  });

  it('SpecificHeroHealthPercent compares the named hero (not the caster) against the threshold', () => {
    const caster = buildTestCombatant({ id: 'caster', hp: 100 });
    const target = buildTestCombatant({ id: 'target', hp: 20 });
    const combatWithAllies = buildCombat({ heroes: [caster, target] });

    expect(
      combatOrderConditionMatches(
        {
          type: 'SpecificHeroHealthPercent',
          characterId: 'target' as CharacterId,
          comparator: 'LessThan',
          value: 50,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        {
          type: 'SpecificHeroHealthPercent',
          characterId: 'target' as CharacterId,
          comparator: 'GreaterThan',
          value: 50,
        },
        combatWithAllies,
        caster,
      ),
    ).toBe(false);
  });

  it('SpecificHeroHealthPercent is false when the named hero is dead or missing from the party', () => {
    const caster = buildTestCombatant({ id: 'caster', hp: 100 });
    const deadTarget = buildTestCombatant({ id: 'dead-target', hp: 0 });
    const combatWithAllies = buildCombat({ heroes: [caster, deadTarget] });
    const condition: CombatOrderCondition = {
      type: 'SpecificHeroHealthPercent',
      characterId: 'dead-target' as CharacterId,
      comparator: 'LessThanOrEqual',
      value: 100,
    };

    expect(
      combatOrderConditionMatches(condition, combatWithAllies, caster),
    ).toBe(false);
    expect(
      combatOrderConditionMatches(
        { ...condition, characterId: 'not-in-party' as CharacterId },
        combatWithAllies,
        caster,
      ),
    ).toBe(false);
  });

  it('EnemyCount counts only living guardians against the given comparator', () => {
    const hero = buildTestCombatant({ id: 'hero', isEnemy: false });
    const aliveGuardian = buildTestCombatant({
      id: 'g1',
      isEnemy: true,
      hp: 10,
    });
    const deadGuardian = buildTestCombatant({ id: 'g2', isEnemy: true, hp: 0 });

    const combatWithGuardians = buildCombat({
      heroes: [hero],
      guardians: [aliveGuardian, deadGuardian],
    });

    expect(
      combatOrderConditionMatches(
        { type: 'EnemyCount', comparator: 'Equal', count: 1 },
        combatWithGuardians,
        hero,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        { type: 'EnemyCount', comparator: 'Equal', count: 2 },
        combatWithGuardians,
        hero,
      ),
    ).toBe(false);
  });

  it('EnemyCountHealthPercent counts only living enemies on the matching side of the threshold', () => {
    const hero = buildTestCombatant({ id: 'hero', hp: 10 });
    const lowGuardian = buildTestCombatant({ id: 'g1', isEnemy: true, hp: 20 });
    const healthyGuardian = buildTestCombatant({
      id: 'g2',
      isEnemy: true,
      hp: 90,
    });
    const deadGuardian = buildTestCombatant({ id: 'g3', isEnemy: true, hp: 0 });

    const combatWithGuardians = buildCombat({
      heroes: [hero],
      guardians: [lowGuardian, healthyGuardian, deadGuardian],
    });
    const condition: CombatOrderCondition = {
      type: 'EnemyCountHealthPercent',
      healthDirection: 'Below',
      healthPercent: 50,
      comparator: 'Equal',
      count: 1,
    };

    // The low-HP hero isn't counted: only g1 is a living enemy below 50%.
    expect(
      combatOrderConditionMatches(condition, combatWithGuardians, hero),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        { ...condition, healthDirection: 'Above' },
        combatWithGuardians,
        hero,
      ),
    ).toBe(true);
    expect(
      combatOrderConditionMatches(
        { ...condition, count: 2 },
        combatWithGuardians,
        hero,
      ),
    ).toBe(false);
  });

  it('EnemyCountHealthPercent from an enemy caster counts heroes and helpers', () => {
    const guardian = buildTestCombatant({ id: 'g1', isEnemy: true, hp: 10 });
    const lowHero = buildTestCombatant({ id: 'hero', hp: 20 });
    const lowHelper = buildTestCombatant({ id: 'helper', hp: 30 });

    expect(
      combatOrderConditionMatches(
        {
          type: 'EnemyCountHealthPercent',
          healthDirection: 'Below',
          healthPercent: 50,
          comparator: 'Equal',
          count: 2,
        },
        buildCombat({
          heroes: [lowHero],
          helpers: [lowHelper],
          guardians: [guardian],
        }),
        guardian,
      ),
    ).toBe(true);
  });
});

describe('matchingCombatantsForCondition', () => {
  it('orders matches by HP %, not raw HP', () => {
    const warrior = buildTestCombatant({
      id: 'warrior',
      hp: 400,
      totalStats: { ...buildTestCombatant().totalStats, Health: 1000 },
    });
    const mage = buildTestCombatant({ id: 'mage', hp: 45 });
    const combat = buildCombat({ heroes: [mage, warrior] });

    expect(
      matchingCombatantsForCondition(combat, mage, {
        type: 'AllyCountHealthPercent',
        healthDirection: 'Below',
        healthPercent: 50,
        comparator: 'GreaterThanOrEqual',
        count: 1,
      }),
    ).toEqual([warrior, mage]);
  });

  it('is undefined for conditions without a matched set', () => {
    expect(
      matchingCombatantsForCondition(buildCombat(), buildTestCombatant(), {
        type: 'EnemyCount',
        comparator: 'Equal',
        count: 1,
      }),
    ).toBeUndefined();
  });
});

describe('pickSkillFromCombatOrders', () => {
  const combat = buildCombat();

  it('returns undefined when there are no clauses configured', () => {
    const combatant = buildTestCombatant({ combatOrders: [] });

    expect(
      pickSkillFromCombatOrders(combat, combatant, [buildEquipmentSkill()]),
    ).toBeUndefined();
  });

  it('skips disabled clauses', () => {
    const combatant = buildTestCombatant({
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: false,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    expect(
      pickSkillFromCombatOrders(combat, combatant, [
        buildEquipmentSkill({ family: 'Fireball' }),
      ]),
    ).toBeUndefined();
  });

  it('picks the first clause whose family resolves and whose condition matches', () => {
    const cure = buildEquipmentSkill({
      id: 'cure' as EquipmentSkillId,
      family: 'Cure',
    });
    const fireball = buildEquipmentSkill({
      id: 'fireball' as EquipmentSkillId,
      family: 'Fireball',
    });
    const combatant = buildTestCombatant({
      hp: 100,
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: true,
          condition: {
            type: 'SelfHealthPercent',
            comparator: 'LessThan',
            value: 50,
          },
          action: { type: 'CastSkillFamily', family: 'Cure' },
        },
        {
          id: 'c2' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    // Full health, so the Cure clause's condition fails and falls through.
    expect(
      pickSkillFromCombatOrders(combat, combatant, [cure, fireball]),
    ).toEqual({ skill: fireball, targetMode: undefined });
  });

  it('falls through a matching clause whose skill is currently unavailable', () => {
    const fireball = buildEquipmentSkill({
      id: 'fireball' as EquipmentSkillId,
      family: 'Fireball',
    });
    const combatant = buildTestCombatant({
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Cure' },
        },
        {
          id: 'c2' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });

    // "Cure" isn't in the available skill list (e.g. unequipped weapon).
    expect(pickSkillFromCombatOrders(combat, combatant, [fireball])).toEqual({
      skill: fireball,
      targetMode: undefined,
    });
  });

  it('threads the target-mode override from the matched clause', () => {
    const fireball = buildEquipmentSkill({
      id: 'fireball' as EquipmentSkillId,
      family: 'Fireball',
    });
    const combatant = buildTestCombatant({
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: {
            type: 'CastSkillFamily',
            family: 'Fireball',
            targetMode: 'Weakest',
          },
        },
      ],
    });

    expect(pickSkillFromCombatOrders(combat, combatant, [fireball])).toEqual({
      skill: fireball,
      targetMode: 'Weakest',
    });
  });

  it('falls through to the next clause when a Self override resolves to zero targets', () => {
    // Mirrors "target self with Fortify, skip if already buffed" - falls through instead of wasting the turn.
    const fortify = buildEquipmentSkill({
      id: 'fortify' as EquipmentSkillId,
      family: 'Fortify',
      techniques: [
        buildTechnique({
          targetType: 'Allies',
          targetBehaviors: [
            {
              behavior: 'IfNotStatusEffect',
              statusEffectId: 'Invigorated' as StatusEffectId,
            },
          ],
        }),
      ],
    });
    const fireball = buildEquipmentSkill({
      id: 'fireball' as EquipmentSkillId,
      family: 'Fireball',
      techniques: [buildTechnique({ targetType: 'Enemies' })],
    });

    const combatant = buildTestCombatant({
      id: 'caster',
      statusEffects: [
        buildStatusEffect({ id: 'Invigorated' as StatusEffectId, duration: 2 }),
      ],
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: {
            type: 'CastSkillFamily',
            family: 'Fortify',
            targetMode: 'Self',
          },
        },
        {
          id: 'c2' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'CastSkillFamily', family: 'Fireball' },
        },
      ],
    });
    // combat.heroes must hold this exact reference - Self matches by identity, not id.
    const combatWithCaster = buildCombat({ heroes: [combatant] });

    expect(
      pickSkillFromCombatOrders(combatWithCaster, combatant, [
        fortify,
        fireball,
      ]),
    ).toEqual({ skill: fireball, targetMode: undefined });
  });

  describe('MatchingEnemies', () => {
    const lowGuardian = buildTestCombatant({
      id: 'low',
      isEnemy: true,
      hp: 20,
    });
    const lowerGuardian = buildTestCombatant({
      id: 'lower',
      isEnemy: true,
      hp: 10,
    });
    const healthyGuardian = buildTestCombatant({
      id: 'healthy',
      isEnemy: true,
      hp: 90,
    });

    function casterWithFamily(family: string): Combatant {
      return buildTestCombatant({
        id: 'caster',
        combatOrders: [
          {
            id: 'c1' as CombatOrderClauseId,
            enabled: true,
            condition: {
              type: 'EnemyCountHealthPercent',
              healthDirection: 'Below',
              healthPercent: 50,
              comparator: 'GreaterThanOrEqual',
              count: 1,
            },
            action: {
              type: 'CastSkillFamily',
              family,
              targetMode: 'MatchingEnemies',
            },
          },
        ],
      });
    }

    it('resolves the matching enemies, lowest HP first', () => {
      const execute = buildEquipmentSkill({
        id: 'execute' as EquipmentSkillId,
        family: 'Execute',
        techniques: [buildTechnique({ targetType: 'Enemies' })],
      });
      const caster = casterWithFamily('Execute');
      const combat = buildCombat({
        heroes: [caster],
        guardians: [lowGuardian, healthyGuardian, lowerGuardian],
      });

      expect(pickSkillFromCombatOrders(combat, caster, [execute])).toEqual({
        skill: execute,
        targetMode: 'MatchingEnemies',
        targetCharacterId: undefined,
        matchingCombatants: [lowerGuardian, lowGuardian],
      });
    });

    it('falls through when the skill cannot target enemies', () => {
      const cure = buildEquipmentSkill({
        id: 'cure' as EquipmentSkillId,
        family: 'Cure',
        techniques: [buildTechnique({ targetType: 'Allies' })],
      });
      const caster = casterWithFamily('Cure');
      const combat = buildCombat({
        heroes: [caster],
        guardians: [lowGuardian],
      });

      expect(pickSkillFromCombatOrders(combat, caster, [cure])).toBeUndefined();
    });
  });

  it('RandomSkill always matches and stops, picking an available skill', () => {
    const cure = buildEquipmentSkill({
      id: 'cure' as EquipmentSkillId,
      family: 'Cure',
    });
    const combatant = buildTestCombatant({
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'RandomSkill' },
        },
      ],
    });

    expect(pickSkillFromCombatOrders(combat, combatant, [cure])).toEqual({
      skill: cure,
    });
  });

  it('RandomSkill returns undefined when nothing is currently available', () => {
    const combatant = buildTestCombatant({
      combatOrders: [
        {
          id: 'c1' as CombatOrderClauseId,
          enabled: true,
          condition: { type: 'Always' },
          action: { type: 'RandomSkill' },
        },
      ],
    });

    expect(pickSkillFromCombatOrders(combat, combatant, [])).toBeUndefined();
  });
});
