import { getEntry } from '@helpers/content';
import type { TownContent, TownId } from '@interfaces';

export function townShopItemCap(townId: TownId): number {
  return getEntry<TownContent>(townId)?.traders.sellItemCount ?? 0;
}
