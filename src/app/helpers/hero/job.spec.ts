import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { ensureTrainerTeaching } from '@helpers/content/ensure-trainer';
import { defaultEquipment } from '@helpers/defaults';
import {
  characterSkills,
  getUnlockedJobs,
  heroSkillsAtLevel,
  heroSkillsWithEquipment,
} from '@helpers/hero/job';
import type {
  EquipmentId,
  EquipmentSkillId,
  ItemId,
  JobId,
  TrainerTeachingId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

describe('Job Helper Functions', () => {
  const mockJobExplorer = ensureJob({
    id: 'job-explorer' as JobId,
    name: 'Explorer',
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
  });

  describe('getUnlockedJobs', () => {
    it('should return every job in content, since all jobs are currently unlocked', () => {
      seedContent([mockJobExplorer, ensureItem({ id: 'item-1' as ItemId })]);

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

  describe('heroSkillsWithEquipment', () => {
    const skill = (name: string) =>
      ensureSkill({ id: name as EquipmentSkillId, name });
    const equipmentGranting = (id: string, grantedSkillId: EquipmentSkillId) =>
      ensureEquipment({
        id: id as EquipmentId,
        type: 'Staff',
        grantedSkillIds: [grantedSkillId],
      });

    const attack = skill('Attack');
    const doubleStrike1 = skill('Double Strike I');
    const doubleStrike2 = skill('Double Strike II');
    const sweep1 = skill('Sweep I');
    const starshine2 = skill('Starshine II');

    const wergenStaff = equipmentGranting('wergen-staff', starshine2.id);
    const ringOfDoubleStrike2 = equipmentGranting(
      'ring-double-strike-2',
      doubleStrike2.id,
    );
    const ringOfDoubleStrike1 = equipmentGranting(
      'ring-double-strike-1',
      doubleStrike1.id,
    );
    const sweepTeaching = ensureTrainerTeaching({
      id: 'teach-sweep' as TrainerTeachingId,
      effects: [{ kind: 'GrantSkill', skillId: sweep1.id }],
    });

    beforeEach(() => {
      seedContent([
        attack,
        doubleStrike1,
        doubleStrike2,
        sweep1,
        starshine2,
        wergenStaff,
        ringOfDoubleStrike2,
        ringOfDoubleStrike1,
        sweepTeaching,
      ]);
    });

    it("returns nothing for a hero whose job doesn't resolve", () => {
      expect(
        characterSkills({
          jobId: 'job-missing' as JobId,
          level: 1,
          equipment: defaultEquipment(),
          teachings: {},
        }),
      ).toEqual([]);
    });

    it("resolves a hero's job to its skills at their level", () => {
      seedContent([mockJobExplorer, attack, doubleStrike1, sweep1]);

      expect(
        characterSkills({
          jobId: mockJobExplorer.id,
          level: 4,
          equipment: defaultEquipment(),
          teachings: {},
        }).map((skill) => skill.id),
      ).toEqual(['Attack', 'Double Strike I', 'Sweep I']);
    });

    it('merges teaching-granted skills alongside equipment grants', () => {
      const skills = heroSkillsWithEquipment(
        mockJobExplorer,
        1,
        defaultEquipment(),
        [sweepTeaching.id],
      );

      expect(skills.map((skill) => skill.id)).toContain('Sweep I');
    });

    it('appends a granted skill the hero has no matching family for', () => {
      const equipment = {
        ...defaultEquipment(),
        Weapon: buildEquipmentItem(wergenStaff.id),
      };

      const skills = heroSkillsWithEquipment(mockJobExplorer, 1, equipment, []);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike I',
        'Starshine II',
      ]);
    });

    it('upgrades a known lower-tier skill in place', () => {
      const equipment = {
        ...defaultEquipment(),
        Ring: buildEquipmentItem(ringOfDoubleStrike2.id),
      };

      const skills = heroSkillsWithEquipment(mockJobExplorer, 1, equipment, []);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike II',
      ]);
    });

    it('ignores a granted skill when a same-or-higher tier is already known', () => {
      const equipment = {
        ...defaultEquipment(),
        Ring: buildEquipmentItem(ringOfDoubleStrike1.id),
      };

      const skills = heroSkillsWithEquipment(mockJobExplorer, 6, equipment, []);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike II',
        'Sweep I',
      ]);
    });
  });
});
