import { resolveRewardDisplay } from '@helpers/item/item-preview';
import type {
  CaravanTokenTrade,
  CaravanTrade,
  ItemPreviewDisplay,
} from '@interfaces';

export function caravanTradeDisplay(
  trade: CaravanTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}

export function caravanTokenTradeDisplay(
  trade: CaravanTokenTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}
