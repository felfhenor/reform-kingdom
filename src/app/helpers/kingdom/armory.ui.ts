import { ARMORY_ENCUMBERED_THRESHOLD } from '@helpers/config';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { gainGold, goldCoinId } from '@helpers/item/materials';
import {
  tradeEquipmentItemLogPart,
  tradeGoodsLogPart,
  tradeLog,
} from '@helpers/item/trade';
import { armoryEntriesFor, equipmentSellValue } from '@helpers/kingdom/armory';
import { syncArmoryGlobalEffects } from '@helpers/kingdom/armory-global-effects';
import { updateGamestate } from '@helpers/state-game';
import type {
  AdventureLogRewardPart,
  EquipmentArmoryEntry,
  EquipmentItemId,
  ProgressBarColor,
} from '@interfaces';
import { sum } from 'es-toolkit/compat';

export function armoryFillColor(
  armorySize: number,
  cap: number,
): ProgressBarColor {
  const ratio = armorySize / cap;
  if (ratio >= 1) return 'error';
  if (ratio >= ARMORY_ENCUMBERED_THRESHOLD) return 'warning';
  return 'muted';
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

function armorySoldLogPart(
  entries: EquipmentArmoryEntry[],
): AdventureLogRewardPart | undefined {
  if (entries.length === 1) {
    return tradeEquipmentItemLogPart(entries[0].item);
  }
  return { html: `${entries.length.toLocaleString()} pieces of equipment` };
}

// Sells owned armory items atomically; stale ids are silently skipped. Returns total gold gained.
export async function sellEquipmentItems(
  equipmentItemIds: EquipmentItemId[],
): Promise<number> {
  const idsToSell = new Set(equipmentItemIds);
  let soldCount = 0;
  let soldPart: AdventureLogRewardPart | undefined;
  let totalGold = 0;

  await updateGamestate((state) => {
    const sold = armoryEntriesFor(
      state.armory.filter((item) => idsToSell.has(item.id)),
    );
    if (sold.length === 0) return state;

    soldCount = sold.length;
    soldPart = armorySoldLogPart(sold);
    totalGold = sum(sold.map((entry) => equipmentSellValue(entry)));
    state.armory = state.armory.filter((item) => !idsToSell.has(item.id));
    syncArmoryGlobalEffects(state);
    gainGold(state, totalGold);
    return state;
  });
  if (soldCount === 0) return 0;

  tradeLog(
    'Miscellaneous',
    'sold',
    [soldPart],
    [tradeGoodsLogPart({ itemId: goldCoinId() }, totalGold)],
  );
  analyticsSendDesignEvent('Kingdom:Armory:MassSell', soldCount);
  return totalGold;
}
