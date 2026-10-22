import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import {
  applyMaterialDelta,
  getGoldQuantity,
  goldCoinId,
  hasGold,
  spendGold,
} from '@helpers/item/materials';
import { tradeCommit } from '@helpers/item/trade';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import {
  townMaterialSaleConfig,
  townMaterialSaleMaxQuantity,
  townMaterialSalePrice,
} from '@helpers/town/shop/town-material-sale';
import type {
  GameState,
  ItemContent,
  ItemId,
  TownContent,
  TownId,
  TownMaterialThreshold,
  TradeCommitOutcome,
} from '@interfaces';

function townMaterialSaleApply(
  state: GameState,
  townId: TownId,
  itemId: ItemId,
  threshold: TownMaterialThreshold,
  quantity: number,
  totalPrice: number,
): TradeCommitOutcome {
  const target = state.world.towns[townId];
  if (!target) return 'rejected';

  const liveAvailable = Math.max(
    0,
    (target.materials[itemId] ?? 0) - threshold.sellAtQuantity,
  );
  const liveGold = state.materials[goldCoinId()]?.quantity ?? 0;
  if (quantity > liveAvailable || totalPrice > liveGold) return 'rejected';

  applyTownMaterialDelta(state, townId, itemId, -quantity);
  applyMaterialDelta(state, itemId, quantity);
  spendGold(state, totalPrice);
  return 'executed';
}

// Keyed by itemId, re-validated against live state inside the commit - a stale request never
// partially executes, since applyTownMaterialDelta clamps at 0 instead of erroring on shortfall.
export async function townExecuteMaterialSale(
  townId: TownId,
  itemId: ItemId,
  quantity = 1,
): Promise<boolean> {
  if (quantity <= 0) return false;

  const town = getEntry<TownContent>(townId);
  if (!town) return false;

  const threshold = townMaterialSaleConfig(town, itemId);
  if (!threshold) return false;

  const price = townMaterialSalePrice(town, threshold);
  const totalPrice = price * quantity;
  if (!hasGold(totalPrice)) return false;

  const maxQuantity = townMaterialSaleMaxQuantity(
    town,
    threshold,
    getGoldQuantity(),
  );
  if (quantity > maxQuantity) return false;

  const executed = await tradeCommit((state) =>
    townMaterialSaleApply(
      state,
      townId,
      itemId,
      threshold,
      quantity,
      totalPrice,
    ),
  );
  if (!executed) return false;

  const name = getEntry<ItemContent>(itemId)?.name;
  analyticsSendDesignEvent(
    name
      ? `Town:MaterialSale:${analyticsSafeSegment(name)}`
      : 'Town:MaterialSale',
  );
  return true;
}
