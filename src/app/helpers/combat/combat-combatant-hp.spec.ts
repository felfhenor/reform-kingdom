import type { Combatant, EquipmentSkill } from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  combatantIsDead,
  combatCombatantTakeDamage,
  combatCombatantTakeEnergyDamage,
} from '@helpers/combat/combat-combatant-hp';
import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { buildTestCombatant } from '@/testing/builders';

function buildCombatant(hp: number, isEnemy = false): Combatant {
  return buildTestCombatant({ isEnemy, hp });
}

describe('combatantIsDead', () => {
  it('is dead at exactly 0 hp', () => {
    expect(combatantIsDead(buildCombatant(0))).toBe(true);
  });

  it('is alive with any hp left', () => {
    expect(combatantIsDead(buildCombatant(1))).toBe(false);
  });
});

describe('combatCombatantTakeDamage', () => {
  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('clamps hp between 0 and max health', () => {
    const hero = buildCombatant(90);

    combatCombatantTakeDamage(hero, -50);
    expect(hero.hp).toBe(100);

    combatCombatantTakeDamage(hero, 500);
    expect(hero.hp).toBe(0);
  });

  it('drops pending delayed skills only on a killing blow', () => {
    const hero = buildCombatant(50);
    hero.delayedSkills = [{ skill: {} as EquipmentSkill, turnsRemaining: 1 }];

    combatCombatantTakeDamage(hero, 25);
    expect(hero.delayedSkills).toHaveLength(1);

    combatCombatantTakeDamage(hero, 25);
    expect(hero.delayedSkills).toEqual([]);
  });

  it('emits a damage event with the sign flipped for a hero taking damage', () => {
    const hero = buildCombatant(100);

    combatCombatantTakeDamage(hero, 25);

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: hero.id, amount: -25 },
    ]);
  });

  it('emits a positive amount for a hero being healed', () => {
    const hero = buildCombatant(50);

    combatCombatantTakeDamage(hero, -25);

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: hero.id, amount: 25 },
    ]);
  });

  it('emits a damage event for an enemy combatant too', () => {
    const enemy = buildCombatant(100, true);

    combatCombatantTakeDamage(enemy, 25);

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: enemy.id, amount: -25 },
    ]);
  });

  it('tags the event with the given variant for a damaging hit', () => {
    const hero = buildCombatant(100);

    combatCombatantTakeDamage(hero, 25, 'critical');

    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: hero.id, amount: -25, variant: 'critical' },
    ]);
  });

  it('drops the variant on a heal', () => {
    const hero = buildCombatant(50);

    combatCombatantTakeDamage(hero, -25, 'critical');

    expect(combatantDamageEvents()[0].variant).toBeUndefined();
  });

  it('does not emit an event when the amount is zero', () => {
    const hero = buildCombatant(100);

    combatCombatantTakeDamage(hero, 0);

    expect(combatantDamageEvents()).toHaveLength(0);
  });
});

describe('combatCombatantTakeEnergyDamage', () => {
  beforeEach(() => {
    combatantDamageEvents.set([]);
  });

  it('emits a signed energy event for a restore', () => {
    const hero = buildTestCombatant({ ep: 10 });

    combatCombatantTakeEnergyDamage(hero, -15);

    expect(hero.ep).toBe(25);
    expect(combatantDamageEvents()).toMatchObject([
      { combatantId: hero.id, amount: 15, variant: 'energy' },
    ]);
  });

  it('does not emit an event when the amount is zero', () => {
    combatCombatantTakeEnergyDamage(buildTestCombatant(), 0);

    expect(combatantDamageEvents()).toHaveLength(0);
  });
});
