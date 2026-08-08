import type { HasAnimation } from '@interfaces/artable';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { BaseStat, StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type JobId = Branded<string, 'JobId'>;

export type JobSkillPathLevel = {
  level: number;
  skillId: EquipmentSkillId;
};

export type JobSkillPath = {
  pathName: string;
  levels: JobSkillPathLevel[];
};

export type JobContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: JobId;

    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    equippableTypes: EquipmentItemType[];

    // Stats an "Optimize Equipment" pass should favor for this job, highest
    // priority first - a candidate item always wins on an earlier stat
    // before a later one is even considered (see `planEquipmentOptimization`
    // in `equipment.ts`). Stats omitted from the list never influence the
    // choice; ties fall back to the item's level requirement instead.
    statPriority: BaseStat[];

    skillPath: JobSkillPath[];
  };
