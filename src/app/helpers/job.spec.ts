import { setAllContentById } from '@helpers/content';
import { getUnlockedJobs, heroSkillsAtLevel } from '@helpers/job';
import type { EquipmentSkillId, IsContentItem, JobContent } from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Job Helper Functions', () => {
  const mockJobExplorer: JobContent = {
    id: 'job-explorer',
    name: 'Explorer',
    __type: 'job',
    description: 'A person who seeks out new lands and experiences.',
    sprite: '0000',
    frames: 4,
    baseStats: {
      Health: 100,
      Energy: 25,
      Luck: 5,
      Intelligence: 5,
      Strength: 5,
      Vitality: 5,
      Resistance: 5,
      Agility: 10,
    },
    statsPerLevel: {
      Health: 10,
      Energy: 5,
      Luck: 0.01,
      Intelligence: 0.2,
      Strength: 0.5,
      Vitality: 0.3,
      Resistance: 0.4,
      Agility: 0.7,
    },
    skillPath: [
      {
        pathName: 'Attack',
        levels: [{ level: 1, skillId: 'Attack' as EquipmentSkillId }],
      },
      {
        pathName: 'Double Strike',
        levels: [
          { level: 1, skillId: 'Double Strike I' as EquipmentSkillId },
          { level: 6, skillId: 'Double Strike II' as EquipmentSkillId },
        ],
      },
      {
        pathName: 'Sweep',
        levels: [{ level: 4, skillId: 'Sweep I' as EquipmentSkillId }],
      },
    ],
  } as JobContent;

  const mockItem: IsContentItem = {
    id: 'item-1',
    name: 'Rock',
    __type: 'item',
  };

  beforeEach(() => {
    setAllContentById(new Map());
  });

  describe('getUnlockedJobs', () => {
    it('should return every job in content, since all jobs are currently unlocked', () => {
      setAllContentById(
        new Map<string, IsContentItem>([
          ['job-explorer', mockJobExplorer],
          ['item-1', mockItem],
        ]),
      );

      const jobs = getUnlockedJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toEqual(mockJobExplorer);
    });

    it('should return an empty array when no jobs are loaded', () => {
      expect(getUnlockedJobs()).toEqual([]);
    });
  });

  describe('heroSkillsAtLevel', () => {
    it('should return only the level 1 unlock of each path at level 1', () => {
      expect(heroSkillsAtLevel(mockJobExplorer, 1)).toEqual([
        'Attack',
        'Double Strike I',
      ]);
    });

    it('should include a path once its level requirement is met', () => {
      expect(heroSkillsAtLevel(mockJobExplorer, 4)).toEqual([
        'Attack',
        'Double Strike I',
        'Sweep I',
      ]);
    });

    it('should upgrade a path to its latest unlocked rank', () => {
      expect(heroSkillsAtLevel(mockJobExplorer, 6)).toEqual([
        'Attack',
        'Double Strike II',
        'Sweep I',
      ]);
    });

    it('should return an empty array when the job has no skill paths', () => {
      expect(
        heroSkillsAtLevel({ ...mockJobExplorer, skillPath: [] }, 10),
      ).toEqual([]);
    });
  });
});
