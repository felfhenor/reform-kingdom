import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { ensureTrainerTeaching } from '@helpers/content/ensure-trainer';
import { defaultEquipment } from '@helpers/defaults';
import {
  characterBurstSkillOptions,
  characterCombatSkills,
  characterNormalSkills,
  characterSkills,
  getUnlockedJobs,
  heroSkillsWithEquipment,
  partyFirstBurstSkillHero,
} from '@helpers/hero/job';
import { trainerTeachingEffects } from '@helpers/trainer/trainer-teaching';
import type {
  EquipmentId,
  EquipmentSkillId,
  HeroEffect,
  ItemId,
  JobId,
  SkillTreeNodeId,
  TrainerTeachingId,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

// A tree node granting `skillId`, named after it.
function skillNode(jobId: JobId, skillId: string, level = 1) {
  return ensureSkillTreeNode({
    id: `node-${skillId}` as SkillTreeNodeId,
    name: `Job: ${skillId}`,
    jobId,
    level,
    effects: [{ kind: 'GrantSkill', skillId: skillId as EquipmentSkillId }],
  });
}

function grant(skillId: string): HeroEffect {
  return { kind: 'GrantSkill', skillId: skillId as EquipmentSkillId };
}

describe('Job Helper Functions', () => {
  const mockJobExplorer = ensureJob({
    id: 'job-explorer' as JobId,
    name: 'Explorer',
  });
  const explorerNodes = [
    skillNode(mockJobExplorer.id, 'Double Strike I'),
    skillNode(mockJobExplorer.id, 'Sweep I', 4),
  ];

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
          skillTreeNodes: {},
        }),
      ).toEqual([]);
    });

    it('knows Attack plus the skills of its learned tree nodes', () => {
      seedContent([
        mockJobExplorer,
        ...explorerNodes,
        attack,
        doubleStrike1,
        sweep1,
      ]);

      expect(
        characterSkills({
          jobId: mockJobExplorer.id,
          level: 4,
          equipment: defaultEquipment(),
          teachings: {},
          skillTreeNodes: {
            [mockJobExplorer.id]: explorerNodes.map((node) => node.id),
          },
        }).map((skill) => skill.id),
      ).toEqual(['Attack', 'Double Strike I', 'Sweep I']);
    });

    it('merges teaching-granted skills alongside equipment grants', () => {
      const skills = heroSkillsWithEquipment(
        defaultEquipment(),
        trainerTeachingEffects([sweepTeaching.id]),
      );

      expect(skills.map((skill) => skill.id)).toContain('Sweep I');
    });

    it('appends a granted skill the hero has no matching family for', () => {
      const equipment = {
        ...defaultEquipment(),
        Weapon: buildEquipmentItem(wergenStaff.id),
      };

      const skills = heroSkillsWithEquipment(equipment, [
        grant('Double Strike I'),
      ]);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Starshine II',
        'Double Strike I',
      ]);
    });

    it('upgrades a known lower-tier skill in place', () => {
      const equipment = {
        ...defaultEquipment(),
        Ring: buildEquipmentItem(ringOfDoubleStrike2.id),
      };

      const skills = heroSkillsWithEquipment(equipment, [
        grant('Double Strike I'),
      ]);

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

      const skills = heroSkillsWithEquipment(equipment, [
        grant('Double Strike II'),
        grant('Sweep I'),
      ]);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike II',
        'Sweep I',
      ]);
    });
  });

  describe('burst skills', () => {
    const strike = ensureSkill({
      id: 'Strike' as EquipmentSkillId,
      name: 'Strike',
      family: 'Strike',
    });
    const burst = (name: string) =>
      ensureSkill({
        id: name as EquipmentSkillId,
        name,
        family: name.replace(/ I+$/, ''),
        special: true,
      });
    const inferno1 = burst('Inferno I');
    const inferno2 = burst('Inferno II');
    const tempest = burst('Tempest');
    const job = ensureJob({ id: 'job-burst' as JobId, name: 'Burster' });
    const nodes = [
      skillNode(job.id, strike.id),
      skillNode(job.id, inferno1.id),
      skillNode(job.id, inferno2.id, 5),
      skillNode(job.id, tempest.id),
    ];
    const hero = (chosen: string[], level = 1) => ({
      jobId: job.id,
      level,
      equipment: defaultEquipment(),
      teachings: {},
      skillTreeNodes: {
        [job.id]: nodes
          .filter((node) => node.level <= level)
          .map((node) => node.id),
      },
      burstSkills: { [job.id]: chosen as EquipmentSkillId[] },
    });

    beforeEach(() =>
      seedContent([job, ...nodes, strike, inferno1, inferno2, tempest]),
    );

    it('keeps special skills out of the normal list', () => {
      expect(characterNormalSkills(hero([])).map((s) => s.id)).toEqual([
        'Strike',
      ]);
    });

    it('offers every learned tier of a burst family, in tier order', () => {
      expect(characterBurstSkillOptions(hero([], 5)).map((s) => s.id)).toEqual([
        'Inferno I',
        'Inferno II',
        'Tempest',
      ]);
    });

    it('lets a lower tier be chosen over a higher one', () => {
      expect(
        characterCombatSkills(hero(['Inferno I'], 5)).map((s) => s.id),
      ).toEqual(['Strike', 'Inferno I']);
    });

    it('fights with normal skills plus only the chosen burst skill', () => {
      expect(
        characterCombatSkills(hero(['Tempest', 'Unknown'])).map((s) => s.id),
      ).toEqual(['Strike', 'Tempest']);
    });

    it('finds the first party hero with a burst skill', () => {
      const plain = ensureJob({ id: 'job-plain' as JobId, name: 'Plain' });
      seedContent([job, ...nodes, plain, strike, inferno1, inferno2, tempest]);
      const party = [
        buildCharacter({ name: 'A', jobId: plain.id }),
        buildCharacter({ name: 'B', ...hero([]) }),
      ];
      expect(partyFirstBurstSkillHero(party)?.name).toBe('B');
      expect(partyFirstBurstSkillHero([party[0]])).toBeUndefined();
    });
  });
});
