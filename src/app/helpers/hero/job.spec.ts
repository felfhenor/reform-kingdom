import { setAllContentById } from '@helpers/content';
import {
  getUnlockedJobs,
  heroSkillsAtLevel,
  heroSkillsWithEquipment,
} from '@helpers/hero/job';
import type {
  EquipmentBlock,
  EquipmentContent,
  EquipmentId,
  EquipmentItemId,
  EquipmentSkillContent,
  EquipmentSkillId,
  IsContentItem,
  JobContent,
} from '@interfaces';
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

  describe('heroSkillsWithEquipment', () => {
    const emptyEquipment: EquipmentBlock = {
      Armor: undefined,
      Helmet: undefined,
      Weapon: undefined,
      Offhand: undefined,
      Ring: undefined,
      Accessory: undefined,
      Artifact: undefined,
      Ammo: undefined,
    };

    function mockSkill(
      overrides: Partial<EquipmentSkillContent>,
    ): EquipmentSkillContent {
      return {
        id: 'skill' as EquipmentSkillId,
        name: 'Skill',
        __type: 'skill',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        epCost: 0,
        usesPerCombat: -1,
        statusEffectDurationBoost: {},
        statusEffectChanceBoost: {},
        techniques: [],
        requiredWeaponTypes: [],
        family: 'Skill',
        ...overrides,
      };
    }

    function mockEquipmentGranting(
      id: EquipmentId,
      grantedSkillIds: EquipmentSkillId[],
    ): EquipmentContent {
      return {
        id,
        name: id,
        __type: 'equipment',
        description: '',
        sprite: '0000',
        rarity: 'Common',
        levelRequirement: 1,
        baseStats: {} as never,
        type: 'Staff',
        slots: 0,
        grantedSkillIds,
      };
    }

    const attack = mockSkill({
      id: 'Attack' as EquipmentSkillId,
      name: 'Attack',
    });
    const doubleStrike1 = mockSkill({
      id: 'Double Strike I' as EquipmentSkillId,
      name: 'Double Strike I',
    });
    const doubleStrike2 = mockSkill({
      id: 'Double Strike II' as EquipmentSkillId,
      name: 'Double Strike II',
    });
    const sweep1 = mockSkill({
      id: 'Sweep I' as EquipmentSkillId,
      name: 'Sweep I',
    });
    const starshine2 = mockSkill({
      id: 'Starshine II' as EquipmentSkillId,
      name: 'Starshine II',
    });

    const wergenStaff = mockEquipmentGranting('wergen-staff' as EquipmentId, [
      starshine2.id,
    ]);
    const ringOfDoubleStrike2 = mockEquipmentGranting(
      'ring-double-strike-2' as EquipmentId,
      [doubleStrike2.id],
    );
    const ringOfDoubleStrike1 = mockEquipmentGranting(
      'ring-double-strike-1' as EquipmentId,
      [doubleStrike1.id],
    );

    beforeEach(() => {
      setAllContentById(
        new Map<string, IsContentItem>([
          ['Attack', attack],
          ['Double Strike I', doubleStrike1],
          ['Double Strike II', doubleStrike2],
          ['Sweep I', sweep1],
          ['Starshine II', starshine2],
          ['wergen-staff', wergenStaff],
          ['ring-double-strike-2', ringOfDoubleStrike2],
          ['ring-double-strike-1', ringOfDoubleStrike1],
        ]),
      );
    });

    it('appends a granted skill the hero has no matching family for', () => {
      const equipment: EquipmentBlock = {
        ...emptyEquipment,
        Weapon: {
          id: 'staff-item' as EquipmentItemId,
          equipmentId: wergenStaff.id,
          infusedItemIds: [],
        },
      };

      const skills = heroSkillsWithEquipment(mockJobExplorer, 1, equipment);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike I',
        'Starshine II',
      ]);
    });

    it('upgrades a known lower-tier skill in place', () => {
      const equipment: EquipmentBlock = {
        ...emptyEquipment,
        Ring: {
          id: 'ring-item' as EquipmentItemId,
          equipmentId: ringOfDoubleStrike2.id,
          infusedItemIds: [],
        },
      };

      const skills = heroSkillsWithEquipment(mockJobExplorer, 1, equipment);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike II',
      ]);
    });

    it('ignores a granted skill when a same-or-higher tier is already known', () => {
      const equipment: EquipmentBlock = {
        ...emptyEquipment,
        Ring: {
          id: 'ring-item' as EquipmentItemId,
          equipmentId: ringOfDoubleStrike1.id,
          infusedItemIds: [],
        },
      };

      const skills = heroSkillsWithEquipment(mockJobExplorer, 6, equipment);

      expect(skills.map((skill) => skill.id)).toEqual([
        'Attack',
        'Double Strike II',
        'Sweep I',
      ]);
    });
  });
});
