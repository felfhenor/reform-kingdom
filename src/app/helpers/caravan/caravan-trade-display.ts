import { resolveRewardDisplay } from '@helpers/item/item-preview';
import type {
  CaravanTokenTrade,
  CaravanTrade,
  ItemPreviewDisplay,
} from '@interfaces';

// Mirrors rewardContentInfo in world-nodes.ts, plus the tooltip fields that helper doesn't carry.
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
