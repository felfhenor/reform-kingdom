import type { CollectibleId } from '@interfaces/content-collectible';
import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type ResearchId = Branded<string, 'ResearchId'>;

export type ResearchMaterialRequirement = {
  itemId: ItemId;
  quantity: number;
};

export type ResearchCost = {
  rp: number;
  gold: number;
  // Empty means no material cost, absent `collectibleId` means no
  // collectible gate. `collectibleId` combines `?:` with an explicit
  // `| undefined` so it's omittable on a plain `ResearchCost` literal while
  // still satisfying `Required<ResearchContent>` with an explicit undefined
  // default - same pattern as `HasMapNodeGating.blockedByResearchId`.
  materials: ResearchMaterialRequirement[];
  collectibleId?: CollectibleId | undefined;
};

export type ResearchEffectTravelTimeReduction = {
  type: 'TravelTimeReduction';
  percent: number;
};

export type ResearchEffectCaravanPriceReduction = {
  type: 'CaravanPriceReduction';
  percent: number;
};

export type ResearchEffectAstralSpellDurationIncrease = {
  type: 'AstralSpellDurationIncrease';
  percent: number;
};

export type ResearchEffectGatherBonusQuantityChance = {
  type: 'GatherBonusQuantityChance';
  chance: number;
  bonusQuantity: number;
};

export type ResearchEffectCraftBonusXpChance = {
  type: 'CraftBonusXpChance';
  chance: number;
  bonusXp: number;
};

export type ResearchEffectCraftBonusXpChanceIncrease = {
  type: 'CraftBonusXpChanceIncrease';
  chance: number;
};

export type ResearchEffectCraftBonusXpAmountIncrease = {
  type: 'CraftBonusXpAmountIncrease';
  bonusXp: number;
};

export type ResearchEffectMonsterBonusGoldChance = {
  type: 'MonsterBonusGoldChance';
  chance: number;
  bonusGold: number;
};

export type ResearchEffectArmorySellValueIncrease = {
  type: 'ArmorySellValueIncrease';
  percent: number;
};

export type ResearchEffectPostWipeHealTimeReduction = {
  type: 'PostWipeHealTimeReduction';
  percent: number;
};

export type ResearchEffectMonsterLootBonusQuantity = {
  type: 'MonsterLootBonusQuantity';
  bonusQuantity: number;
};

export type ResearchEffectMaterialAutomation = {
  type: 'MaterialAutomation';
  itemId: ItemId;
  quantityPerGrant: number;
  ticksPerGrant: number;
};

// Every consumer sums the relevant variant across all currently-completed
// research rather than any node mutating another's stored value - e.g. Keen
// Eye's own chance/bonus stay fixed, Sharper Eye/Deeper Insight are separate
// completed-or-not contributions added on top at read time.
export type ResearchEffect =
  | ResearchEffectTravelTimeReduction
  | ResearchEffectCaravanPriceReduction
  | ResearchEffectAstralSpellDurationIncrease
  | ResearchEffectGatherBonusQuantityChance
  | ResearchEffectCraftBonusXpChance
  | ResearchEffectCraftBonusXpChanceIncrease
  | ResearchEffectCraftBonusXpAmountIncrease
  | ResearchEffectMonsterBonusGoldChance
  | ResearchEffectArmorySellValueIncrease
  | ResearchEffectPostWipeHealTimeReduction
  | ResearchEffectMonsterLootBonusQuantity
  | ResearchEffectMaterialAutomation;

export type ResearchContent = IsContentItem &
  HasDescription & {
    id: ResearchId;
    __type: 'research';

    prerequisiteResearchIds: ResearchId[];
    cost: ResearchCost;

    // Ticks the active-research timer must reach, after the upfront cost is
    // paid, before this node completes.
    researchTime: number;

    // Absent for nodes whose only job is being an id referenced elsewhere
    // (astral cap raises, blockedByResearchId targets) rather than
    // contributing a derivable effect themselves.
    effect?: ResearchEffect | undefined;
  };
