import type { CollectibleId } from '@interfaces/content-collectible';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { RecipeId } from '@interfaces/content-recipe';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type CaravanTraderId = Branded<string, 'CaravanTraderId'>;

// `sell` = the trader sells to the party (party pays gold). `buy` = the
// trader buys from the party (party receives gold).
export type CaravanTradeType = 'sell' | 'buy';

export type CaravanTrade = {
  type: CaravanTradeType;

  // Base gold price before the owning caravan's markup is applied.
  value: number;

  itemId?: ItemId;
  equipmentId?: EquipmentId;
  collectibleId?: CollectibleId;
  // A recipe sale is one-time like a collectible.
  recipeId?: RecipeId;

  // Omitted for unlimited-quantity trades (e.g. unique collectible sells).
  limit?: number;

  // Relative likelihood this trade is chosen when a caravan rerolls its
  // active trade selection.
  weight: number;
};

// A trader's own token-priced offerings - always visible, bought with
// Trader Scrips instead of gold.
export type CaravanTokenTrade = {
  tokenCost: number;

  itemId?: ItemId;
  equipmentId?: EquipmentId;
  collectibleId?: CollectibleId;
  recipeId?: RecipeId;
};

export type CaravanTraderContent = IsContentItem &
  HasDescription & {
    id: CaravanTraderId;
    __type: 'caravantrader';

    category: string;

    level: number;

    trades: CaravanTrade[];
    tokenTrades: CaravanTokenTrade[];
  };
