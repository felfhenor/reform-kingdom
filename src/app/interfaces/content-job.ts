import type { HasAnimation } from '@interfaces/artable';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
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

    skillPath: JobSkillPath[];
  };
