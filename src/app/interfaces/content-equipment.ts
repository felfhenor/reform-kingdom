import type { HasSprite } from '@interfaces/artable';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { StatusEffectTag } from '@interfaces/content-statuseffect';
import type { HasRarity } from '@interfaces/droppable';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type EquipmentId = Branded<string, 'EquipmentId'>;

export type EquipmentContent = IsContentItem &
  HasDescription &
  HasSprite &
  HasRarity & {
    id: EquipmentId;
    levelRequirement: number;
    baseStats: StatBlock;
    // Optional like `ItemContent.infusionStats` - only meaningful once
    // `ensureEquipment` fills it densely; hand-built test fixtures may omit it.
    debuffResistances?: Record<StatusEffectTag, number>;
    type: EquipmentItemType;
    slots: number;

    // Skills a hero learns simply by having this equipped - merged into
    // their job-path skills (see `mergeGrantedSkills`/`heroSkillsWithEquipment`).
    grantedSkillIds: EquipmentSkillId[];

    unobtainable?: boolean;
  };
