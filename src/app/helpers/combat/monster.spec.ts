import {
  isXpTrivialAtOverLevel,
  monstersFromFights,
  monsterStatsAtLevel,
  monsterXpReward,
  xpForOverLevel,
} from '@helpers/combat/monster';
import { setAllContentById, setAllIdsByName } from '@helpers/content';
import type { EquipmentSkillId, ItemId, MonsterContent } from '@interfaces';
import { describe, expect, it } from 'vitest';

describe('Monster Helper Functions', () => {
  const goldCoinId = 'gold-coin' as ItemId;

  const mockMonster: MonsterContent = {
    id: 'monster-1' as MonsterContent['id'],
    name: 'Goblin',
    __type: 'monster',
    description: '',
    sprite: '0000',
    frames: 4,
    rarity: 'Common',
    baseStats: {
      Health: 10,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 1,
      Vitality: 0,
      Resistance: 0,
      Agility: 1,
    },
    statsPerLevel: {
      Health: 0,
      Energy: 0,
      Luck: 0,
      Intelligence: 0,
      Strength: 0,
      Vitality: 0,
      Resistance: 0,
      Agility: 0,
    },
    targettingType: 'Random',
    xp: { min: 3, max: 5, bonusPerLevel: 1 },
    drops: [
      {
        kind: 'Item',
        itemId: goldCoinId,
        min: 3,
        max: 10,
        bonusPerLevel: 1,
        chance: 100,
      },
    ],
    skills: [{ skillId: 'Attack' as EquipmentSkillId, weight: 1 }],
  };

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
    it('should return full xp at or below the node max level', () => {
      expect(xpForOverLevel(100, 4, 5)).toBe(100);
      expect(xpForOverLevel(100, 5, 5)).toBe(100);
    });

    it('should degrade xp by 25% per level over the node max', () => {
      expect(xpForOverLevel(100, 6, 5)).toBe(75);
      expect(xpForOverLevel(100, 7, 5)).toBe(50);
      expect(xpForOverLevel(100, 8, 5)).toBe(25);
    });

    it('should hard-cap xp at 1 once 4+ levels over the node max', () => {
      expect(xpForOverLevel(100, 9, 5)).toBe(1);
      expect(xpForOverLevel(100, 20, 5)).toBe(1);
    });

    it('should never degrade below 1 xp even for small raw amounts', () => {
      expect(xpForOverLevel(2, 8, 5)).toBe(1);
    });
  });

  describe('isXpTrivialAtOverLevel', () => {
    it('is false at or below the node max level', () => {
      expect(isXpTrivialAtOverLevel(4, 5)).toBe(false);
      expect(isXpTrivialAtOverLevel(5, 5)).toBe(false);
    });

    it('is false while still within the degrade range', () => {
      expect(isXpTrivialAtOverLevel(8, 5)).toBe(false);
    });

    it('is true once 4+ levels over the node max, matching the xpForOverLevel hard cap', () => {
      expect(isXpTrivialAtOverLevel(9, 5)).toBe(true);
      expect(isXpTrivialAtOverLevel(20, 5)).toBe(true);
    });
  });

  describe('monstersFromFights', () => {
    const goblin: MonsterContent = {
      ...mockMonster,
      id: 'goblin' as MonsterContent['id'],
      name: 'Goblin',
    };
    const wolf: MonsterContent = {
      ...mockMonster,
      id: 'wolf' as MonsterContent['id'],
      name: 'Wolf',
    };
    const ant: MonsterContent = {
      ...mockMonster,
      id: 'ant' as MonsterContent['id'],
      name: 'Ant',
    };

    it('resolves and sorts the monsters referenced across every fight alphabetically', () => {
      setAllIdsByName(new Map());
      setAllContentById(
        new Map([
          [goblin.id, goblin],
          [wolf.id, wolf],
          [ant.id, ant],
        ]),
      );

      const fights = [
        { monsters: [{ monsterId: wolf.id }, { monsterId: goblin.id }] },
        { monsters: [{ monsterId: ant.id }] },
      ];

      expect(monstersFromFights(fights).map((monster) => monster.name)).toEqual(
        ['Ant', 'Goblin', 'Wolf'],
      );
    });

    it('de-dupes monsters that appear in multiple fights', () => {
      setAllIdsByName(new Map());
      setAllContentById(new Map([[goblin.id, goblin]]));

      const fights = [
        { monsters: [{ monsterId: goblin.id }] },
        { monsters: [{ monsterId: goblin.id }] },
      ];

      expect(monstersFromFights(fights)).toEqual([goblin]);
    });

    it('skips monster ids with no matching content', () => {
      setAllIdsByName(new Map());
      setAllContentById(new Map());

      expect(
        monstersFromFights([{ monsters: [{ monsterId: goblin.id }] }]),
      ).toEqual([]);
    });

    it('returns an empty array when there are no fights', () => {
      expect(monstersFromFights([])).toEqual([]);
    });
  });
});
