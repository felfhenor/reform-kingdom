import {
  isXpTrivialAtOverLevel,
  monsterSkillsAtLevel,
  monstersFromFights,
  monsterStatsAtLevel,
  monsterXpReward,
  xpForOverLevel,
} from '@helpers/combat/monster';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  OVERLEVEL_XP_DEGRADE_PER_LEVEL,
  OVERLEVEL_XP_HARD_CAP_AMOUNT,
  OVERLEVEL_XP_HARD_CAP_LEVELS,
} from '@helpers/config';
import { ensureStats } from '@helpers/content/ensure-helpers-stats';
import {
  ensureMonster,
  ensureMonsterSkill,
} from '@helpers/content/ensure-monster';
import type {
  EquipmentSkillId,
  ItemId,
  MonsterContent,
  MonsterId,
} from '@interfaces';
import { describe, expect, it } from 'vitest';
import { seedContent } from '@/testing/content';

describe('Monster Helper Functions', () => {
  const goldCoinId = 'gold-coin' as ItemId;

  const mockMonster = ensureMonster({
    id: 'monster-1' as MonsterId,
    name: 'Goblin',
    baseStats: ensureStats({ Health: 10, Strength: 1, Agility: 1 }),
    xp: { min: 3, max: 5, bonusPerLevel: 1 },
    drops: [
      ensureDroppedReward({
        itemId: goldCoinId,
        min: 3,
        max: 10,
        bonusPerLevel: 1,
        chance: 100,
      }),
    ],
    skills: [ensureMonsterSkill({ skillId: 'Attack' as EquipmentSkillId })],
  });

  describe('monsterStatsAtLevel', () => {
    it('returns baseStats unchanged at level 1', () => {
      expect(monsterStatsAtLevel(mockMonster, 1)).toEqual(
        mockMonster.baseStats,
      );
    });

    it('scales stats by statsPerLevel for higher levels', () => {
      const monster = {
        ...mockMonster,
        statsPerLevel: { ...mockMonster.statsPerLevel, Health: 5, Strength: 2 },
      };

      const stats = monsterStatsAtLevel(monster, 3);

      expect(stats.Health).toBe(mockMonster.baseStats.Health + 5 * 2);
      expect(stats.Strength).toBe(mockMonster.baseStats.Strength + 2 * 2);
    });
  });

  describe('monsterSkillsAtLevel', () => {
    const gnash = 'Gnash I' as EquipmentSkillId;
    const monster: MonsterContent = {
      ...mockMonster,
      skills: [
        ensureMonsterSkill({ skillId: 'Attack' as EquipmentSkillId }),
        ensureMonsterSkill({ skillId: gnash, minLevel: 10, maxLevel: 20 }),
      ],
    };

    it('includes ungated skills at every level', () => {
      expect(monsterSkillsAtLevel(monster, 1)).toHaveLength(1);
      expect(monsterSkillsAtLevel(monster, 99)).toHaveLength(1);
    });

    it('returns nothing when no skill covers the level', () => {
      const gated: MonsterContent = {
        ...mockMonster,
        skills: [ensureMonsterSkill({ skillId: gnash, minLevel: 10 })],
      };

      expect(monsterSkillsAtLevel(gated, 9)).toEqual([]);
    });

    it('includes a gated skill on both bounds and excludes it outside them', () => {
      const ids = (level: number) =>
        monsterSkillsAtLevel(monster, level).map((s) => s.skillId);

      expect(ids(9)).not.toContain(gnash);
      expect(ids(10)).toContain(gnash);
      expect(ids(20)).toContain(gnash);
      expect(ids(21)).not.toContain(gnash);
    });
  });

  describe('monsterXpReward', () => {
    it('should return a value within the level-scaled xp range across many rolls', () => {
      // bonusPerLevel is 1, so level 1 grants a range of [3+1, 5+1].
      for (let i = 0; i < 50; i++) {
        const xp = monsterXpReward(mockMonster, 1);
        expect(xp).toBeGreaterThanOrEqual(4);
        expect(xp).toBeLessThanOrEqual(6);
      }
    });

    it('should scale the xp range by level * bonusPerLevel', () => {
      // bonusPerLevel is 1, so level 3 grants a range of [3+3, 5+3].
      for (let i = 0; i < 50; i++) {
        const xp = monsterXpReward(mockMonster, 3);
        expect(xp).toBeGreaterThanOrEqual(6);
        expect(xp).toBeLessThanOrEqual(8);
      }
    });
  });

  describe('xpForOverLevel', () => {
    const capLevel = 5 + OVERLEVEL_XP_HARD_CAP_LEVELS;

    it('returns full xp at or below the node max level', () => {
      expect(xpForOverLevel(100, 4, 5)).toBe(100);
      expect(xpForOverLevel(100, 5, 5)).toBe(100);
    });

    it('degrades xp further for each level over the node max', () => {
      expect(xpForOverLevel(100, 6, 5)).toBe(
        Math.round(100 * (1 - OVERLEVEL_XP_DEGRADE_PER_LEVEL)),
      );
      expect(xpForOverLevel(100, 7, 5)).toBe(
        Math.round(100 * (1 - 2 * OVERLEVEL_XP_DEGRADE_PER_LEVEL)),
      );
    });

    it('hard-caps xp once far enough over the node max', () => {
      expect(xpForOverLevel(100, capLevel, 5)).toBe(
        OVERLEVEL_XP_HARD_CAP_AMOUNT,
      );
      expect(xpForOverLevel(100, capLevel + 10, 5)).toBe(
        OVERLEVEL_XP_HARD_CAP_AMOUNT,
      );
    });

    it('never degrades below the hard-cap amount, even for small raw amounts', () => {
      expect(xpForOverLevel(1, capLevel - 1, 5)).toBeGreaterThanOrEqual(
        OVERLEVEL_XP_HARD_CAP_AMOUNT,
      );
    });
  });

  describe('isXpTrivialAtOverLevel', () => {
    const capLevel = 5 + OVERLEVEL_XP_HARD_CAP_LEVELS;

    it('is false at or below the node max level', () => {
      expect(isXpTrivialAtOverLevel(4, 5)).toBe(false);
      expect(isXpTrivialAtOverLevel(5, 5)).toBe(false);
    });

    it('is false while still within the degrade range', () => {
      expect(isXpTrivialAtOverLevel(capLevel - 1, 5)).toBe(false);
    });

    it('is true from the xp hard cap onward', () => {
      expect(isXpTrivialAtOverLevel(capLevel, 5)).toBe(true);
      expect(isXpTrivialAtOverLevel(capLevel + 10, 5)).toBe(true);
    });
  });

  describe('monstersFromFights', () => {
    const goblin: MonsterContent = {
      ...mockMonster,
      id: 'goblin' as MonsterId,
      name: 'Goblin',
    };
    const wolf: MonsterContent = {
      ...mockMonster,
      id: 'wolf' as MonsterId,
      name: 'Wolf',
    };
    const ant: MonsterContent = {
      ...mockMonster,
      id: 'ant' as MonsterId,
      name: 'Ant',
    };

    it('resolves and sorts the monsters referenced across every fight alphabetically', () => {
      seedContent([goblin, wolf, ant]);

      const fights = [
        { monsters: [{ monsterId: wolf.id }, { monsterId: goblin.id }] },
        { monsters: [{ monsterId: ant.id }] },
      ];

      expect(monstersFromFights(fights).map((monster) => monster.name)).toEqual(
        ['Ant', 'Goblin', 'Wolf'],
      );
    });

    it('de-dupes monsters that appear in multiple fights', () => {
      seedContent([goblin]);

      const fights = [
        { monsters: [{ monsterId: goblin.id }] },
        { monsters: [{ monsterId: goblin.id }] },
      ];

      expect(monstersFromFights(fights)).toEqual([goblin]);
    });

    it('skips monster ids with no matching content', () => {
      expect(
        monstersFromFights([{ monsters: [{ monsterId: goblin.id }] }]),
      ).toEqual([]);
    });

    it('returns an empty array when there are no fights', () => {
      expect(monstersFromFights([])).toEqual([]);
    });
  });
});
