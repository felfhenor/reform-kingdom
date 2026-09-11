import { SHOP_TICK_INTERVAL } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate } from '@helpers/state-game';
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
    target.stock = target.stock.filter(
      (entry) => nowTick - entry.addedAtTick < itemExpirationTimer,
    );
    return state;
  });
}

export function townShopProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'shop', SHOP_TICK_INTERVAL)) return;

    expireTownStock(town);
    markTownSubsystemProcessed(town.id, 'shop');
  });
}
