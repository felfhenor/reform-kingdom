import { getEntry } from '@helpers/content/content';
import { refundQueueEntry } from '@helpers/crafting/crafting-reserved-equipment';
import {
  tradeskillBuildingIn,
  tradeskillIdForName,
} from '@helpers/crafting/tradeskill';
import { updateGamestate } from '@helpers/state-game';
import type { CraftQueueEntryId, RecipeContent, Tradeskill } from '@interfaces';

// Refunds only the unconsumed remainder of the batch - units already
// crafted keep the materials/equipment they used.
export function craftQueueRemove(
  tradeskill: Tradeskill,
  queueEntryId: CraftQueueEntryId,
): void {
  const tradeskillId = tradeskillIdForName(tradeskill);
  if (!tradeskillId) return;

  updateGamestate((state) => {
    const building = tradeskillBuildingIn(state, tradeskillId);
    const entry = building.queue.find((queued) => queued.id === queueEntryId);
    if (!entry) return state;

    refundQueueEntry(state, entry, getEntry<RecipeContent>(entry.recipeId));

    state.tradeskills[tradeskillId] = {
      ...building,
      queue: building.queue.filter((queued) => queued.id !== queueEntryId),
    };

    return state;
  });
}
