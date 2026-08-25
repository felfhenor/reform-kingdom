import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type CaravanTraderId = Branded<string, 'CaravanTraderId'>;

// `sell` = the trader sells to the party (party pays gold). `buy` = the
// trader buys from the party (party receives gold).
export type CaravanTradeType = 'sell' | 'buy';

export type CaravanTrade = {
  type: CaravanTradeType;

  // Base gold price before the owning caravan's markup is applied - see
  // `CaravanContent.markupPercentages`.
  value: number;

  itemId?: ItemId;
  equipmentId?: EquipmentId;
  collectibleId?: CollectibleId;

  // Omitted for unlimited-quantity trades (e.g. unique collectible sells).
  limit?: number;

  // Relative likelihood this trade is chosen when a caravan rerolls its
  // active trade selection out of the trader's full `trades` list.
  weight: number;
};

// A trader's own token-priced offerings - always visible (not subject to
// the 4-slot weighted `trades` rotation), bought with Trader Scrips instead
// of gold. Named generically since the reward won't always be a collectible.
export type CaravanTokenTrade = {
  tokenCost: number;

  itemId?: ItemId;
  equipmentId?: EquipmentId;
  collectibleId?: CollectibleId;
};

export type CaravanTraderContent = IsContentItem &
  HasDescription & {
    id: CaravanTraderId;
    __type: 'caravantrader';

    // Matched against a caravan's `traderCategories` to determine
    // eligibility.
    category: string;

    level: number;

    trades: CaravanTrade[];
    tokenTrades: CaravanTokenTrade[];
  };
