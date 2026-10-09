import {
  combatantHasLivingSummon,
  combatHasCombatant,
  combatSummonMonster,
} from '@helpers/combat/combat-summon';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { defaultStats } from '@helpers/defaults';
import type { MonsterId } from '@interfaces';
import {
  buildCombat,
  buildMonsterCombatant,
  buildTestCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { beforeEach, describe, expect, it } from 'vitest';

const wolf = ensureMonster({
  id: 'wolf' as MonsterId,
  name: 'Wolf',
  baseStats: { ...defaultStats(), Health: 50 },
});

beforeEach(() => {
  seedContent([wolf]);
});

describe('combatSummonMonster', () => {
  it("adds a hero's summon to the helpers at the caster's level", () => {
    const hero = buildTestCombatant({ id: 'hero-1', level: 7 });
    const combat = buildCombat({ heroes: [hero] });

    const summon = combatSummonMonster(combat, hero, wolf.id);

    expect(combat.helpers).toEqual([summon]);
    expect(combat.guardians).toEqual([]);
    expect(summon).toMatchObject({
      isEnemy: false,
      summonerId: 'hero-1',
      level: 7,
      monsterId: wolf.id,
    });
  });

  it("adds an enemy's summon to the guardians", () => {
    const enemy = buildMonsterCombatant(wolf, { id: 'enemy-1' });
    const combat = buildCombat({ guardians: [enemy] });

    const summon = combatSummonMonster(combat, enemy, wolf.id);

    expect(combat.guardians).toEqual([enemy, summon]);
    expect(summon?.isEnemy).toBe(true);
  });

  it("replaces only the caster's own previous summon", () => {
    const hero = buildTestCombatant({ id: 'hero-1' });
    const other = buildTestCombatant({ id: 'hero-2' });
    const combat = buildCombat({ heroes: [hero, other] });

    const first = combatSummonMonster(combat, hero, wolf.id);
    const othersSummon = combatSummonMonster(combat, other, wolf.id);
    const second = combatSummonMonster(combat, hero, wolf.id);

    expect(combat.helpers).toEqual([othersSummon, second]);
    expect(combat.helpers).not.toContain(first);
  });

  it('does nothing for an unknown monster', () => {
    const hero = buildTestCombatant();
    const combat = buildCombat({ heroes: [hero] });

    expect(combatSummonMonster(combat, hero, 'missing')).toBeUndefined();
    expect(combat.helpers).toEqual([]);
  });
});

describe('combatantHasLivingSummon', () => {
  it('is true only while the summon is alive', () => {
    const hero = buildTestCombatant({ id: 'hero-1' });
    const combat = buildCombat({ heroes: [hero] });

    expect(combatantHasLivingSummon(combat, hero)).toBe(false);

    const summon = combatSummonMonster(combat, hero, wolf.id)!;
    expect(combatantHasLivingSummon(combat, hero)).toBe(true);

    summon.hp = 0;
    expect(combatantHasLivingSummon(combat, hero)).toBe(false);
  });
});

describe('combatHasCombatant', () => {
  it('is false once a summon has been replaced', () => {
    const hero = buildTestCombatant({ id: 'hero-1' });
    const combat = buildCombat({ heroes: [hero] });
    const first = combatSummonMonster(combat, hero, wolf.id)!;

    expect(combatHasCombatant(combat, hero)).toBe(true);
    expect(combatHasCombatant(combat, first)).toBe(true);

    combatSummonMonster(combat, hero, wolf.id);
    expect(combatHasCombatant(combat, first)).toBe(false);
  });
});
