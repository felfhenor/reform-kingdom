import type { HasSprite } from '@interfaces/artable';
import type { CombatStatBlock } from '@interfaces/combat';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
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
    debuffResistances?: StatusEffectBlock;
    // flat combat-stat bonus granted to the wearer at combat start
    combatStats?: CombatStatBlock;
    type: EquipmentItemType;
    slots: number;

    // Skills a hero learns simply by having this equipped
    grantedSkillIds: EquipmentSkillId[];

    unobtainable?: boolean;
  };
