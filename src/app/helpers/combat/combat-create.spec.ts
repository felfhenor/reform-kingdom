import { beforeEach, describe, expect, it } from 'vitest';

import {
  combatantFromCharacter,
  combatantFromMonster,
  combatantsFromTownGuardians,
  combatCreateForEncounter,
} from '@helpers/combat/combat-create';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import {
  ensureMonster,
  ensureMonsterSkill,
} from '@helpers/content/ensure-monster';
import { ensureSkill } from '@helpers/content/ensure-skill';
import {
  defaultCombatStats,
  defaultEquipment,
  defaultStats,
} from '@helpers/defaults';
import type {
  Character,
  EquipmentContent,
  EquipmentId,
  EquipmentSkillId,
  GameState,
  JobId,
  MonsterContent,
  MonsterId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const rangerId = 'ranger' as JobId;
const bowId = 'bow' as EquipmentId;
const attackId = 'attack' as EquipmentSkillId;
const snipeId = 'snipe' as EquipmentSkillId;
const citizenId = 'larsian-citizen' as MonsterId;
const guardId = 'larsian-guard' as MonsterId;

const citizen = ensureMonster({ id: citizenId, name: 'Larsian Citizen' });
const guard = ensureMonster({ id: guardId, name: 'Larsian Guard' });

function seedRanger(bow: Partial<EquipmentContent> = {}): void {
  seedContent([
    ensureJob({
      id: rangerId,
      name: 'Ranger',
      equippableTypes: ['Bow'],
      skillPath: [
        { pathName: 'Attack', levels: [{ level: 1, skillId: attackId }] },
        { pathName: 'Snipe', levels: [{ level: 1, skillId: snipeId }] },
      ],
    }),
    ensureSkill({ id: attackId, name: 'Attack' }),
    ensureSkill({ id: snipeId, name: 'Snipe', requiredWeaponTypes: ['Bow'] }),
    ensureEquipment({ id: bowId, name: 'Bow', type: 'Bow', ...bow }),
    citizen,
    guard,
  ]);
}

function ranger(overrides: Partial<Character> = {}): Character {
  return buildCharacter({ jobId: rangerId, ...overrides });
}

function withBow(): Partial<Character> {
  return {
    equipment: { ...defaultEquipment(), Weapon: buildEquipmentItem(bowId) },
  };
}

function withEffects(edit: (sums: GameState['globalEffectSums']) => void) {
  seedGamestate((state) => edit(state.globalEffectSums));
}

beforeEach(() => {
  seedRanger();
  seedGamestate();
});

describe('combatantFromCharacter', () => {
  it('fights as a hero with the character’s job, level and pools', () => {
    const character = ranger({ level: 4, hp: 6, ep: 3 });

    expect(combatantFromCharacter(character)).toMatchObject({
      id: character.id,
      isEnemy: false,
      jobId: rangerId,
      level: 4,
      hp: 6,
      ep: 3,
      totalStats: character.stats,
    });
  });

  it('only gets a weapon-gated skill while the required weapon is equipped', () => {
    expect(combatantFromCharacter(ranger()).skillIds).toEqual([attackId]);
    expect(sortBy(combatantFromCharacter(ranger(withBow())).skillIds)).toEqual([
      attackId,
      snipeId,
    ]);
  });

  it("carries equipped gear's combat stats and skill stat bonuses", () => {
    seedRanger({
      combatStats: { ...defaultCombatStats(), damageReflectPercent: 10 },
      skillStatBonuses: [
        { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
      ],
    });

    const combatant = combatantFromCharacter(ranger(withBow()));

    expect(combatant.combatStats.damageReflectPercent).toBe(10);
    expect(combatant.skillStatBonuses).toEqual([
      { skillFamily: 'Fireball', stat: 'Vitality', value: 2 },
    ]);
  });

  it('applies active stat buffs, topping up current hp/ep by Health/Energy gains', () => {
    withEffects((sums) => {
      sums.stats = { ...defaultStats(), Strength: 5, Health: 25, Energy: 25 };
      sums.xpGainMultiplierBonus = 0.1;
    });
    const character = ranger({ hp: 6, ep: 4 });

    const combatant = combatantFromCharacter(character);

    expect(combatant.statBoosts).toEqual({
      ...defaultStats(),
      Strength: 5,
      Health: 25,
      Energy: 25,
    });
    expect(combatant.totalStats.Strength).toBe(character.stats.Strength + 5);
    expect(combatant.totalStats.Health).toBe(character.stats.Health + 25);
    expect(combatant.hp).toBe(6 + 25);
    expect(combatant.ep).toBe(4 + 25);
  });

  it('applies active combat-stat and debuff-resistance buffs', () => {
    withEffects((sums) => {
      sums.combatStats.reviveChance = 2;
      sums.debuffResistanceTags.Accuracy = 5;
      sums.debuffResistanceFlat = 3;
    });

    const combatant = combatantFromCharacter(ranger());

    expect(combatant.combatStats.reviveChance).toBe(2);
    expect(combatant.tagResistance.Accuracy).toBe(5 + 3);
    expect(combatant.tagResistance.Stun).toBe(3);
  });
});

describe('combatantFromMonster', () => {
  const hawk = (skills: MonsterContent['skills'] = []) =>
    ensureMonster({
      id: 'hawk' as MonsterId,
      name: 'Hawk',
      targetting: [{ type: 'Random', jobId: rangerId }, { type: 'Random' }],
      skills,
    });

  it('fights as an enemy with its targetting, ignoring weapon gates and hero buffs', () => {
    withEffects((sums) => (sums.stats.Strength = 5));

    const monster = hawk([ensureMonsterSkill({ skillId: snipeId })]);

    const combatant = combatantFromMonster(monster, 7, 2);

    expect(combatant).toMatchObject({
      isEnemy: true,
      monsterId: 'hawk',
      name: 'Hawk Lv.7 [C]',
      level: 7,
      skillIds: [snipeId],
      statBoosts: defaultStats(),
      targetting: monster.targetting,
    });
    expect(monster.targetting[0]).toEqual({ type: 'Random', jobId: rangerId });
  });

  it('only carries skills whose level range covers the monster level, with their weights', () => {
    const monster = hawk([
      ensureMonsterSkill({ skillId: attackId, weight: 5 }),
      ensureMonsterSkill({ skillId: snipeId, minLevel: 30, weight: 3 }),
    ]);

    expect(combatantFromMonster(monster, 29, 0)).toMatchObject({
      skillIds: [attackId],
      skillWeights: { [attackId]: 5 },
    });
    expect(combatantFromMonster(monster, 30, 0)).toMatchObject({
      skillIds: [attackId, snipeId],
      skillWeights: { [attackId]: 5, [snipeId]: 3 },
    });
  });
});

describe('combatantsFromTownGuardians', () => {
  it('spawns allied combatants per quantity, lettered across entries, skipping missing monsters', () => {
    const combatants = combatantsFromTownGuardians(
      [
        { monsterId: citizenId, quantity: 2 },
        { monsterId: 'gone' as MonsterId, quantity: 4 },
        { monsterId: guardId, quantity: 2 },
      ],
      25,
    );

    expect(combatants.map((c) => c.name)).toEqual([
      'Larsian Citizen Lv.25 [A]',
      'Larsian Citizen Lv.25 [B]',
      'Larsian Guard Lv.25 [C]',
      'Larsian Guard Lv.25 [D]',
    ]);
    expect(combatants.every((c) => !c.isEnemy && c.level === 25)).toBe(true);
  });
});

describe('combatCreateForEncounter', () => {
  it('builds a fresh combat with the party as heroes and the monsters as guardians', () => {
    const party = [ranger({ name: 'Ada' }), ranger({ name: 'Bo' })];

    const combat = combatCreateForEncounter(
      party,
      [citizen, guard],
      12,
      'Field Ruins',
    );

    expect(combat).toMatchObject({
      locationName: 'Field Ruins',
      rounds: 0,
      helpers: [],
    });
    expect(combat.heroes.map((hero) => hero.name)).toEqual(['Ada', 'Bo']);
    expect(combat.guardians.map((guardian) => guardian.name)).toEqual([
      'Larsian Citizen Lv.12 [A]',
      'Larsian Guard Lv.12 [B]',
    ]);
  });
});
