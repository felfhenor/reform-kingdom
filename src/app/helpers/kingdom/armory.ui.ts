import { ARMORY_ENCUMBERED_THRESHOLD } from '@helpers/config';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { gainGold } from '@helpers/item/materials';
import { equipmentSellValue, getArmoryEntries } from '@helpers/kingdom/armory';
import { syncArmoryGlobalEffects } from '@helpers/kingdom/armory-global-effects';
import { updateGamestate } from '@helpers/state-game';
import type {
  DaisyColor,
  EquipmentArmoryEntry,
  EquipmentItemId,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

export function armoryFillColor(armorySize: number, cap: number): DaisyColor {
  const ratio = armorySize / cap;
  if (ratio >= 1) return 'error';
  if (ratio >= ARMORY_ENCUMBERED_THRESHOLD) return 'warning';
  return 'info';
}

export function filterArmoryEntries(
  entries: EquipmentArmoryEntry[],
  searchText: string,
): EquipmentArmoryEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    const itemName = equipmentItemDisplayName(entry.item, entry.content.name);
    if (itemName.toLowerCase().includes(text)) return true;
    if (entry.content.description.toLowerCase().includes(text)) return true;

    return false;
  });
}

// Sells owned armory items atomically; stale ids are silently skipped. Returns total gold gained.
export function sellEquipmentItems(
  equipmentItemIds: EquipmentItemId[],
): number {
  const idsToSell = new Set(equipmentItemIds);
  const entries = getArmoryEntries().filter((entry) =>
    idsToSell.has(entry.item.id),
  );
  if (entries.length === 0) return 0;

  const totalGold = sum(entries.map((entry) => equipmentSellValue(entry)));

  updateGamestate((state) => {
    state.armory = state.armory.filter((item) => !idsToSell.has(item.id));
    syncArmoryGlobalEffects(state);
    gainGold(state, totalGold);
    return state;
  });

  analyticsSendDesignEvent('Kingdom:Armory:MassSell', entries.length);
  return totalGold;
}
