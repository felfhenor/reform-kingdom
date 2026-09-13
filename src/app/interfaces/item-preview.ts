import type { CombatStatBlock } from '@interfaces/combat';
import type { CollectibleContent } from '@interfaces/content-collectible';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';
import type { MonsterType } from '@interfaces/content-monster';
import type { EquipmentSkillContent } from '@interfaces/content-skill';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { WorkerContent } from '@interfaces/content-worker';
import type { DropRarity } from '@interfaces/droppable';
import type { StatBlock } from '@interfaces/stat';

// The three content kinds a recipe, stored material, or caravan trade can
// resolve to.
export type ItemPreviewContent =
  ItemContent | EquipmentContent | CollectibleContent | WorkerContent;

export type ItemPreviewSpritesheet =
  'item' | 'equipment' | 'collectible' | 'worker';

export type ItemPreviewDisplay = {
  name: string;
  description: string;
  sprite: string;
  spritesheet: ItemPreviewSpritesheet;
  rarity: DropRarity;
  // Infusion stats for an item, base stats for equipment - undefined for a
  // collectible, or an item with no infusion stats to show.
  stats?: StatBlock;
  resistances?: StatusEffectBlock;
  combatStats?: CombatStatBlock;
  monsterTypeDamage?: Record<MonsterType, number>;
  // Affix + infusion bonus on top of `stats`/`resistances`/`combatStats` - set only when previewing a specific rolled instance.
  bonusStats?: StatBlock;
  bonusResistances?: StatusEffectBlock;
  bonusCombatStats?: CombatStatBlock;
  bonusMonsterTypeDamage?: Record<MonsterType, number>;
  // Equipment only - base content plus any rolled GatherYield affix, merged by tradeskill and resolved to a display name/icon.
  gatherYieldBonuses?: {
    tradeskillName: string;
    tradeskillSprite: string;
    value: number;
  }[];
  // Affix effects with no dedicated display elsewhere (caravan discounts).
  miscAffixDescriptions?: string[];
  skills?: EquipmentSkillContent[];
  // Equipment only.
  levelRequirement?: number;
  // Equipment only - party hero names whose job can equip this item.
  equippableHeroNames?: string[];
  // Recipe trades only - composited behind `sprite`.
  backdropSprite?: string;
};
