import { setAllContentById } from '@helpers/content';
import { getUnlockedJobs } from '@helpers/job';
import type { IsContentItem, JobContent } from '@interfaces';
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
});
