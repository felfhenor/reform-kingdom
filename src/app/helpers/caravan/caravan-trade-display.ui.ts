import { equipmentItemDisplayName } from '@helpers/item/affix';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import type {
  CaravanTokenTrade,
  CaravanTrade,
  EquipmentItem,
  ItemPreviewDisplay,
} from '@interfaces';

export function caravanTradeDisplay(
  trade: CaravanTrade,
  equipmentItem?: EquipmentItem,
): ItemPreviewDisplay | undefined {
  const display = resolveRewardDisplay({ ...trade, equipmentItem });
  if (!display) return undefined;

  // Rolled affixes change the display name (e.g. "Flaming Wergen Staff") - the base content alone doesn't know this specific instance's roll.
  return equipmentItem
    ? {
        ...display,
        name: equipmentItemDisplayName(equipmentItem, display.name),
      }
    : display;
}

export function caravanTokenTradeDisplay(
  trade: CaravanTokenTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}
