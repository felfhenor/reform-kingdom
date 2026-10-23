import { describe, expect, it } from 'vitest';

import { caravanTraderSoldGoodIds } from '@helpers/caravan/caravan-trader-goods';
import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import type {
  CaravanTraderId,
  CollectibleId,
  EquipmentId,
  ItemId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { seedContent } from '@/testing/content';

describe('caravanTraderSoldGoodIds', () => {
  it('collects gold and token sales across traders, skipping buys and collectibles', () => {
    seedContent([
      ensureCaravanTrader({
        id: 'alekia' as CaravanTraderId,
        name: 'Alekia',
        trades: [
          { type: 'sell', value: 1, itemId: 'water' as ItemId, weight: 1 },
          { type: 'buy', value: 1, itemId: 'ore' as ItemId, weight: 1 },
          {
            type: 'sell',
            value: 1,
            collectibleId: 'idol' as CollectibleId,
            weight: 1,
          },
        ],
      }),
      ensureCaravanTrader({
        id: 'juke' as CaravanTraderId,
        name: 'Juke',
        tokenTrades: [{ tokenCost: 3, equipmentId: 'hat' as EquipmentId }],
      }),
    ]);

    expect(sortBy([...caravanTraderSoldGoodIds()])).toEqual(['hat', 'water']);
  });
});
