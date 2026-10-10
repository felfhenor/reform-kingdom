import { REFORGE_GOLD_PER_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  stateEquippedItem,
  stateOwnedEquipmentItem,
  stateReplaceOwnedEquipmentItem,
} from '@helpers/hero/character-equipment';
import { rollAffixIds } from '@helpers/item/affix';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import {
  goldCoinId,
  isMaterialDiscovered,
  reforgeReagentId,
} from '@helpers/item/materials';
import { RARITY_SELL_MULTIPLIER } from '@helpers/kingdom/armory';
import {
  stateCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import type {
  CostItem,
  DropRarity,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentReforgeResult,
  GameState,
} from '@interfaces';
import { AffixCountByRarity } from '@interfaces';

export const REFORGE_REAGENT_BY_RARITY: Record<DropRarity, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Mystical: 3,
  Legendary: 5,
};

export function isReforgeUnlocked(): boolean {
  return isMaterialDiscovered(reforgeReagentId());
}

export function isReforgeable(content: EquipmentContent): boolean {
  return AffixCountByRarity[content.rarity] > 0;
}

export function equipmentItemReforgeCost(item: EquipmentItem): CostItem[] {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  if (!content || !isReforgeable(content)) return [];

  const gold = Math.round(
    Math.max(1, content.levelRequirement) *
      REFORGE_GOLD_PER_LEVEL *
      RARITY_SELL_MULTIPLIER[content.rarity],
  );

  return [
    { itemId: goldCoinId(), required: gold },
    {
      itemId: reforgeReagentId(),
      required: REFORGE_REAGENT_BY_RARITY[content.rarity],
    },
  ];
}

// Gems in sockets beyond the new slot count would otherwise keep granting their bonus.
export function reforgedEquipmentItem(item: EquipmentItem): EquipmentItem {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  if (!content) return item;

  const rerolled: EquipmentItem = {
    ...item,
    affixIds: rollAffixIds(content, true),
  };
  rerolled.infusedItemIds = item.infusedItemIds.slice(
    0,
    equipmentItemSlotCount(rerolled),
  );

  return rerolled;
}

// Re-validates against live state since a UI-triggered write is deferred past the click's own checks.
export function applyEquipmentReforge(
  state: GameState,
  equipmentItemId: EquipmentItemId,
): EquipmentReforgeResult {
  const item = stateOwnedEquipmentItem(state, equipmentItemId);
  if (!item) return 'missing';
  if (stateEquippedItem(state, equipmentItemId) && state.world.combat) {
    return 'in-combat';
  }

  const cost = equipmentItemReforgeCost(item);
  if (cost.length === 0) return 'not-reforgeable';
  if (!stateCanAffordCost(state, cost)) return 'unaffordable';

  stateReplaceOwnedEquipmentItem(state, reforgedEquipmentItem(item));

  worldNodeSpendCost(state, cost);
  return 'ok';
}
