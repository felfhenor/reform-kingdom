import { REFORGE_GOLD_PER_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { replaceEquippedItemInstance } from '@helpers/hero/character-equipment';
import { rollAffixIds } from '@helpers/item/affix';
import { equippedItems } from '@helpers/item/equipment';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { goldCoinId, reforgeReagentId } from '@helpers/item/materials';
import { RARITY_SELL_MULTIPLIER } from '@helpers/kingdom/armory';
import { worldNodeSpendCost } from '@helpers/world-node/world-node-cost';
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
    affixIds: rollAffixIds(content.rarity, content.levelRequirement),
  };
  rerolled.infusedItemIds = item.infusedItemIds.slice(
    0,
    equipmentItemSlotCount(rerolled),
  );

  return rerolled;
}

function replaceInParty(state: GameState, reforged: EquipmentItem): void {
  state.world.party = state.world.party.map((character) =>
    equippedItems(character.equipment).some((item) => item.id === reforged.id)
      ? replaceEquippedItemInstance(character, reforged)
      : character,
  );
}

function stateCanAffordCost(state: GameState, cost: CostItem[]): boolean {
  return cost.every(
    (entry) => (state.materials[entry.itemId]?.quantity ?? 0) >= entry.required,
  );
}

function stateEquippedItem(
  state: GameState,
  equipmentItemId: EquipmentItemId,
): EquipmentItem | undefined {
  return state.world.party
    .flatMap((character) => equippedItems(character.equipment))
    .find((item) => item.id === equipmentItemId);
}

export function stateOwnedEquipmentItem(
  state: GameState,
  equipmentItemId: EquipmentItemId,
): EquipmentItem | undefined {
  return (
    state.armory.find((item) => item.id === equipmentItemId) ??
    stateEquippedItem(state, equipmentItemId)
  );
}

// Re-validates against live state since a UI-triggered write is deferred past the click's own checks.
export function applyEquipmentReforge(
  state: GameState,
  equipmentItemId: EquipmentItemId,
): EquipmentReforgeResult {
  const armoryIndex = state.armory.findIndex(
    (item) => item.id === equipmentItemId,
  );
  const equipped = stateEquippedItem(state, equipmentItemId);
  const item = armoryIndex !== -1 ? state.armory[armoryIndex] : equipped;
  if (!item) return 'missing';
  if (equipped && state.world.combat) return 'in-combat';

  const cost = equipmentItemReforgeCost(item);
  if (cost.length === 0) return 'not-reforgeable';
  if (!stateCanAffordCost(state, cost)) return 'unaffordable';

  const reforged = reforgedEquipmentItem(item);
  if (armoryIndex !== -1) {
    state.armory[armoryIndex] = reforged;
  } else {
    replaceInParty(state, reforged);
  }

  worldNodeSpendCost(state, cost);
  return 'ok';
}
