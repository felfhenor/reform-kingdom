import { getEntriesByType } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type { TownContent } from '@interfaces';

// Checking stock ages is cheap - run every tick so an expired entry disappears promptly, not in whatever-tick-interval batches.
const SHOP_TICK_INTERVAL = 1;

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
