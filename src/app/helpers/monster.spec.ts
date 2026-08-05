import { monsterXpReward } from '@helpers/monster';
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
    xp: { min: 3, max: 5, multiplierPerLevel: 1 },
    drops: [
      { itemId: goldCoinId, min: 3, max: 10, multiplierPerLevel: 1, chance: 100 },
    ],
    skills: [{ skillId: 'Attack' as EquipmentSkillId }],
  };

  describe('monsterXpReward', () => {
    it('should return a value within the monster xp range across many rolls', () => {
      for (let i = 0; i < 50; i++) {
        const xp = monsterXpReward(mockMonster, 1);
        expect(xp).toBeGreaterThanOrEqual(3);
        expect(xp).toBeLessThanOrEqual(5);
      }
    });

    it('should scale the xp range by the multiplier per level', () => {
      for (let i = 0; i < 50; i++) {
        const xp = monsterXpReward(mockMonster, 3);
        expect(xp).toBeGreaterThanOrEqual(5);
        expect(xp).toBeLessThanOrEqual(7);
      }
    });
  });
});
