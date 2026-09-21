import type { HasSprite } from '@interfaces/artable';
import type { CombatStatBlock } from '@interfaces/combat';
import type { GatherYieldBonus } from '@interfaces/content-affix';
import type { MonsterType } from '@interfaces/content-monster';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { HasRarity } from '@interfaces/droppable';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { SkillStatBonus, StatBlock } from '@interfaces/stat';
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
    // percent damage bonus dealt to monsters of the given type, same as the MonsterTypeDamage affix
    monsterTypeDamage?: Record<MonsterType, number>;
    // flat bonus quantity per successful gather for the given tradeskill, same as the GatherYield affix
    gatherYieldBonuses?: GatherYieldBonus[];
    // extra damageScaling on every technique of a skill family, same as the SkillStatBonus affix
    skillStatBonuses?: SkillStatBonus[];
    type: EquipmentItemType;
    slots: number;

    // Skills a hero learns simply by having this equipped
    grantedSkillIds: EquipmentSkillId[];

    unobtainable?: boolean;
  };
