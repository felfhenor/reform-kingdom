import type { CombatStat } from '@interfaces/combat';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { StatusEffectTag } from '@interfaces/content-statuseffect';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { DropRarity, HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { BaseStat } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type AffixId = Branded<string, 'AffixId'>;

export type AffixEffectStat = {
  kind: 'Stat';
  stat: BaseStat;
  value: number; // negative = curse
};

export type AffixEffectCombatStat = {
  kind: 'CombatStat';
  stat: CombatStat;
  value: number; // negative = curse
};

export type AffixEffectResistance = {
  kind: 'Resistance';
  tag: StatusEffectTag;
  value: number;
};

export type AffixEffectInfusionSlot = {
  kind: 'InfusionSlot';
  value: number;
};

export type AffixEffectGrantSkill = {
  kind: 'GrantSkill';
  skillId: EquipmentSkillId;
};

export type AffixEffectGatherYield = {
  kind: 'GatherYield';
  tradeskillId: TradeskillId;
  value: number; // flat bonus quantity per successful gather
};

export type AffixEffectSellValue = {
  kind: 'SellValue';
  value: number; // flat gold added to armory sell price
};

export type AffixEffectCaravanBuyDiscount = {
  kind: 'CaravanBuyDiscount';
  value: number; // percent off caravan purchase prices
};

export type AffixEffectCaravanSellBonus = {
  kind: 'CaravanSellBonus';
  value: number; // percent bonus on caravan sale gold
};

export type AffixEffect =
  | AffixEffectStat
  | AffixEffectCombatStat
  | AffixEffectResistance
  | AffixEffectInfusionSlot
  | AffixEffectGrantSkill
  | AffixEffectGatherYield
  | AffixEffectSellValue
  | AffixEffectCaravanBuyDiscount
  | AffixEffectCaravanSellBonus;

// Where this affix's name sits relative to the base item name when composing a display name, e.g. "Weakening" (Prefix) Copper Ring vs Copper Ring "of Strength" (Suffix).
export type AffixPosition = 'Prefix' | 'Suffix';

export type AffixContent = IsContentItem &
  HasDescription &
  HasRarity & {
    id: AffixId;
    __type: 'affix';

    // Cross-tier identity, same idea as skill `family` - an item never rolls two affixes of the same family.
    family: string;

    position: AffixPosition;

    // Multiple effects let one affix do several things at once (e.g. a stat bonus plus a curse elsewhere).
    effects: AffixEffect[];
  };

// How many affixes an equipped item rolls, keyed by the item's own rarity.
export const AffixCountByRarity: Record<DropRarity, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Mystical: 3,
  Legendary: 4,
};
