import { VALID_CARAVAN_TRADE_TYPES } from '@helpers/content/ensure-helpers-constants';
import {
  ensureArray,
  ensureEnumValue,
} from '@helpers/content/ensure-helpers-core';
import { ensureCommissionOfferSlot } from '@helpers/content/ensure-helpers-quests';
import type {
  CaravanContent,
  CaravanId,
  CaravanTokenTrade,
  CaravanTrade,
  CaravanTraderContent,
  CaravanTraderId,
} from '../../interfaces';

function ensureCaravanTrade(trade: Partial<CaravanTrade> = {}): CaravanTrade {
  return {
    type: ensureEnumValue(trade.type, VALID_CARAVAN_TRADE_TYPES, 'sell'),
    value: trade.value ?? 0,
    itemId: trade.itemId,
    equipmentId: trade.equipmentId,
    collectibleId: trade.collectibleId,
    recipeId: trade.recipeId,
    limit: trade.limit,
    weight: trade.weight ?? 1,
  };
}

export function ensureCaravan(
  caravan: Partial<CaravanContent>,
): Required<CaravanContent> {
  return {
    id: caravan.id ?? ('UNKNOWN' as CaravanId),
    name: caravan.name ?? 'UNKNOWN',
    __type: 'caravan',
    description: caravan.description ?? 'UNKNOWN',
    traderResetTime: caravan.traderResetTime ?? 3600,
    level: caravan.level ?? { min: 1, max: 1 },
    markupPercentages: caravan.markupPercentages ?? { sell: 0, buy: 0 },
    traderCategories: caravan.traderCategories ?? [],
    commissionOffers: ensureArray(
      caravan.commissionOffers,
      ensureCommissionOfferSlot,
    ),
    hidden: caravan.hidden ?? false,
    invisibleUntilCollectibleIdsFound:
      caravan.invisibleUntilCollectibleIdsFound ?? [],
  };
}

function ensureCaravanTokenTrade(
  trade: Partial<CaravanTokenTrade> = {},
): CaravanTokenTrade {
  return {
    tokenCost: trade.tokenCost ?? 3,
    itemId: trade.itemId,
    equipmentId: trade.equipmentId,
    collectibleId: trade.collectibleId,
    recipeId: trade.recipeId,
  };
}

export function ensureCaravanTrader(
  trader: Partial<CaravanTraderContent>,
): Required<CaravanTraderContent> {
  return {
    id: trader.id ?? ('UNKNOWN' as CaravanTraderId),
    name: trader.name ?? 'UNKNOWN',
    __type: 'caravantrader',
    description: trader.description ?? 'UNKNOWN',
    category: trader.category ?? 'UNKNOWN',
    level: trader.level ?? 1,
    trades: ensureArray(trader.trades, ensureCaravanTrade),
    tokenTrades: ensureArray(trader.tokenTrades, ensureCaravanTokenTrade),
  };
}
