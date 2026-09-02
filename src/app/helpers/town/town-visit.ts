import { getEntry } from '@helpers/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townWorkerRosterMaterialize } from '@helpers/town/worker/town-worker-roster';
import type { TownContent, TownId } from '@interfaces';

// Activates a town's crafting/workers/commissions on first visit - inert until then. Idempotent, and only fires analytics on the actual first visit.
export function townMarkVisited(townId: TownId): void {
  const alreadyVisited =
    gamestate().world.towns[townId]?.firstVisitedAtTick !== undefined;
  const town = getEntry<TownContent>(townId);

  updateGamestate((state) => {
    const existing = state.world.towns[townId];
    if (existing?.firstVisitedAtTick !== undefined) return state;

    state.world.towns[townId] = {
      lastProcessedTick: existing?.lastProcessedTick ?? {},
      stock: existing?.stock ?? [],
      workers: town
        ? townWorkerRosterMaterialize(town, existing?.workers ?? {})
        : (existing?.workers ?? {}),
      firstVisitedAtTick: timerTicksElapsed(),
    };
    return state;
  });

  if (!alreadyVisited) {
    analyticsSendDesignEvent(
      `Town:Visit:${analyticsSafeSegment(town?.name ?? townId)}`,
    );
  }
}
