import type { HasSprite } from '@interfaces/artable';
import type { CombatStatBlock } from '@interfaces/combat';
import type { GatherYieldBonus } from '@interfaces/content-affix';
import type { MonsterType } from '@interfaces/content-monster';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { SkillStatBonus, StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type ItemId = Branded<string, 'ItemId'>;

export type ItemContent = IsContentItem &
  HasDescription &
  HasSprite &
  HasRarity & {
    id: ItemId;

    // Flat stat bonus granted when this item is infused into an equipment
    // slot. Absent for ordinary materials - only a small set of items opt
    // into being infusable.
    infusionStats?: StatBlock;

    infusionDebuffResistances?: StatusEffectBlock;

    infusionCombatStats?: CombatStatBlock;

    infusionMonsterTypeDamage?: Record<MonsterType, number>;
    infusionGatherYieldBonuses?: GatherYieldBonus[];
    infusionSkillStatBonuses?: SkillStatBonus[];

    unobtainable?: boolean;
  };
