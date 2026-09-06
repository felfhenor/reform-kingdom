import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townTradeskillsMaterialize } from '@helpers/town/crafting/town-craft-tradeskills';
import { townWorkerRosterMaterialize } from '@helpers/town/worker/town-worker-roster';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { TownContent, TownId } from '@interfaces';

export function isPartyAtTown(townId: TownId): boolean {
  const entry = worldNodeAtCurrentLocation();
  return !!entry && worldNodeTown(entry)?.id === townId;
}

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
      reputation: existing?.reputation ?? 0,
      hiddenGold: existing?.hiddenGold ?? 0,
      materials: existing?.materials ?? {},
      tradeskills: townTradeskillsMaterialize(
        townId,
        existing?.tradeskills ?? {},
      ),
      craftQueue: existing?.craftQueue ?? [],
      commissionSlots: existing?.commissionSlots ?? [],
      specialtyPriority: existing?.specialtyPriority ?? [],
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
