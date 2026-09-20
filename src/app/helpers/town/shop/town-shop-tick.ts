import { SHOP_TICK_INTERVAL } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate } from '@helpers/state-game';
import { updateTownNode } from '@helpers/town/town-node';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type { TownContent } from '@interfaces';

function expireTownStock(town: TownContent): void {
  const { itemExpirationTimer } = town.traders;
  if (itemExpirationTimer <= 0) return; // 0/negative = expiration disabled for this town

  updateGamestate((state) => {
    const target = state.world.towns[town.id];
    if (!target) return state;

    const nowTick = timerTicksElapsed();
    const stock = target.stock.filter(
      (entry) => nowTick - entry.addedAtTick < itemExpirationTimer,
    );
    if (stock.length === target.stock.length) return state;

    return updateTownNode(state, town.id, (node) => {
      node.stock = stock;
    });
  });
}

export function townShopProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'shop', SHOP_TICK_INTERVAL)) return;

    expireTownStock(town);
    markTownSubsystemProcessed(town.id, 'shop', SHOP_TICK_INTERVAL);
  });
}
