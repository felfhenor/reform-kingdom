import { describe, expect, it } from 'vitest';

import { combatVictoryMoments } from '@helpers/combat/combat-victory-moments';
import { ensureAffix } from '@helpers/content/ensure-affix';
import type {
  AffixId,
  Combat,
  EncounterRandomId,
  EquipmentId,
} from '@interfaces';
import {
  buildCharacter,
  buildCombat,
  buildEquipmentItem,
  buildTestCombatant,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

// Test combatants have 100 Health, so hp reads as a percentage.
function won(overrides: Partial<Combat> = {}, ...heroHp: number[]) {
  return combatVictoryMoments(
    buildCombat({
      rounds: 1,
      heroes: (heroHp.length > 0 ? heroHp : [100]).map((hp, index) =>
        buildTestCombatant({ id: `hero-${index}`, hp }),
      ),
      guardians: [buildTestCombatant({ id: 'monster', isEnemy: true, hp: 0 })],
      ...overrides,
    }),
  );
}

const wonWith = (...heroHp: number[]) => won({}, ...heroHp);

describe('combatVictoryMoments', () => {
  it('marks nothing for an ordinary win', () => {
    expect(won()).toEqual([]);
  });

  it('marks a win in the ambush round', () => {
    expect(won({ rounds: 0 })).toEqual(['AmbushVictory']);
  });

  it('marks a win after a hero died covering an ally', () => {
    expect(won({ heroDiedCovering: true })).toEqual(['CoverDeathVictory']);
  });

  it('marks a win over a monster 10+ levels above the strongest hero', () => {
    const fightAt = (level: number, summonerId?: string) =>
      won({
        heroes: [
          buildTestCombatant({ id: 'low', level: 1 }),
          buildTestCombatant({ id: 'high', level: 20 }),
        ],
        guardians: [
          buildTestCombatant({ isEnemy: true, hp: 0, level, summonerId }),
        ],
      });

    expect(fightAt(30)).toEqual(['GiantSlayerVictory']);
    expect(fightAt(29)).toEqual([]);
    expect(fightAt(30, 'boss')).toEqual([]);
  });

  it("marks a win after a hero's retaliation killed an enemy", () => {
    expect(won({ heroRetaliationKill: true })).toEqual([
      'RetaliationKillVictory',
    ]);
  });

  it('marks a win with one hero left standing at 5% HP or less', () => {
    expect(wonWith(5, 0)).toEqual(['LastHeroStandingVictory']);
  });

  it('needs a party of two, one hero standing, and that hero nearly down', () => {
    expect(wonWith(1)).toEqual([]);
    expect(wonWith(5, 5)).toEqual([]);
    expect(wonWith(6, 0)).toEqual([]);
  });
});

describe('combatVictoryMoments for a cursed mystical clear', () => {
  const curse = ensureAffix({ id: 'curse' as AffixId, family: 'Curse' });

  function clearWith(cursedHeroes: boolean[], overrides: Partial<Combat> = {}) {
    seedContent([curse]);
    seedGamestate((state) => {
      state.world.party = cursedHeroes.map((isCursed) => {
        const hero = buildCharacter();
        hero.equipment.Weapon = buildEquipmentItem('blade' as EquipmentId, {
          affixIds: isCursed ? [curse.id] : [],
        });
        return hero;
      });
      state.world.exploreRandom['ruins' as EncounterRandomId] = {
        fights: [
          { level: 1, monsters: [] },
          { level: 1, monsters: [] },
        ],
        generatedAtTick: 0,
        completedThisCycle: false,
      };
    });
    return combatVictoryMoments(
      buildCombat({
        rounds: 1,
        encounterRandomId: 'ruins' as EncounterRandomId,
        fightIndex: 1,
        guardians: [buildTestCombatant({ isEnemy: true, hp: 0 })],
        ...overrides,
      }),
    );
  }

  it('marks the last fight of a mystical node won with every hero cursed', () => {
    expect(clearWith([true, true])).toEqual(['CursedRandomClearVictory']);
  });

  it('needs every hero cursed', () => {
    expect(clearWith([true, false])).toEqual([]);
  });

  it("ignores a node's earlier fights, and fights that aren't a mystical node", () => {
    expect(clearWith([true, true], { fightIndex: 0 })).toEqual([]);
    expect(clearWith([true, true], { encounterRandomId: undefined })).toEqual(
      [],
    );
  });
});
