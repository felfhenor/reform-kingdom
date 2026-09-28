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
  return resolveRewardDisplay({ ...trade, equipmentItem });
}

export function caravanTokenTradeDisplay(
  trade: CaravanTokenTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}
