import { LOOT_FILTER_AUTO_SELL_PERCENT } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { newEquipmentItem } from '@helpers/item/equipment';
import { gainGold } from '@helpers/item/materials';
import {
  addArmoryItems,
  equipmentSellValue,
  markEquipmentDiscovered,
} from '@helpers/kingdom/armory';
import { updateGamestate } from '@helpers/state-game';
import type {
  EquipmentContent,
  EquipmentId,
  LootFilterSettings,
} from '@interfaces';

export function equipmentPassesLootFilter(
  content: EquipmentContent,
  filters: LootFilterSettings,
): boolean {
  if (!filters.keepRarities[content.rarity]) return false;
  if (content.levelRequirement < filters.minimumItemLevel) return false;
  if (!filters.keepEquipmentTypes[content.type]) return false;
  return true;
}

export type LootDropOutcome =
  | { kind: 'NoRoom' }
  | { kind: 'UnknownContent' }
  | { kind: 'Kept'; content: EquipmentContent }
  | { kind: 'AutoSold'; content: EquipmentContent; goldEarned: number };

// A drop that fails the filter is sold before it ever reaches the armory,
// so only a *kept* drop can be lost to a full armory (NoRoom).
export function armoryAddLootDrop(equipmentId: EquipmentId): LootDropOutcome {
  let outcome: LootDropOutcome = { kind: 'NoRoom' };

  updateGamestate((state) => {
    const content = getEntry<EquipmentContent>(equipmentId);
    if (!content) {
      const admitted = addArmoryItems(
        state,
        equipmentId,
        [newEquipmentItem(equipmentId)],
        true,
      );
      outcome = admitted[0] ? { kind: 'UnknownContent' } : { kind: 'NoRoom' };
      return state;
    }

    const item = newEquipmentItem(equipmentId);

    if (!equipmentPassesLootFilter(content, state.lootFilters)) {
      markEquipmentDiscovered(state, equipmentId);

      const goldEarned = Math.round(
        equipmentSellValue({ item, content }) * LOOT_FILTER_AUTO_SELL_PERCENT,
      );
      gainGold(state, goldEarned);

      outcome = { kind: 'AutoSold', content, goldEarned };
      return state;
    }

    const admitted = addArmoryItems(state, equipmentId, [item], true);
    outcome = admitted[0] ? { kind: 'Kept', content } : { kind: 'NoRoom' };
    return state;
  });

  return outcome;
}
