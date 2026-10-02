import {
  TOWN_FIRST_VISIT_COMPLETED_CRAFT_COUNT,
  TOWN_FIRST_VISIT_CRAFT_COUNT,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import {
  townCompleteInitialCrafts,
  townQueueInitialCrafts,
} from '@helpers/town/crafting/town-craft-queue';
import { townTradeskillsMaterialize } from '@helpers/town/crafting/town-craft-tradeskills';
import { townDefaultMaterials } from '@helpers/town/town-materials';
import { townWorkerRosterMaterialize } from '@helpers/town/worker/town-worker-roster';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { TownContent, TownId } from '@interfaces';
import { taskEventTownVisited } from '@helpers/task/task-events';

export function isPartyAtTown(townId: TownId): boolean {
  const entry = worldNodeAtCurrentLocation();
  return !!entry && worldNodeTown(entry)?.id === townId;
}

// Activates a town's crafting/workers/commissions on first visit - inert until then. Idempotent, and only fires analytics on the actual first visit.
export function townMarkVisited(townId: TownId): void {
  const alreadyVisited =
    worldTownsState()[townId]?.firstVisitedAtTick !== undefined;
  const town = getEntry<TownContent>(townId);

  updateGamestate((state) => {
    const existing = state.world.towns[townId];
    if (existing?.firstVisitedAtTick !== undefined) return state;

    const now = timerTicksElapsed();
    state.world.towns[townId] = {
      lastProcessedTick: existing?.lastProcessedTick ?? {},
      stock: existing?.stock ?? [],
      workers: town
        ? townWorkerRosterMaterialize(town, existing?.workers ?? {})
        : (existing?.workers ?? {}),
      reputation: existing?.reputation ?? 0,
      hiddenGold: existing?.hiddenGold ?? 0,
      materials: {
        ...(town ? townDefaultMaterials(town) : {}),
        ...existing?.materials,
      },
      tradeskills: townTradeskillsMaterialize(
        townId,
        existing?.tradeskills ?? {},
      ),
      craftQueue: existing?.craftQueue ?? [],
      commissionSlots: existing?.commissionSlots ?? [],
      specialtyPriority: existing?.specialtyPriority ?? [],
      firstVisitedAtTick: now,
      // Starts the raid cooldown so a town isn't raided the moment it's found.
      lastRaidResolvedAtTick: existing?.lastRaidResolvedAtTick ?? now,
    };
    if (town) {
      townCompleteInitialCrafts(
        state,
        town,
        TOWN_FIRST_VISIT_COMPLETED_CRAFT_COUNT,
      );
      townQueueInitialCrafts(state, town, TOWN_FIRST_VISIT_CRAFT_COUNT);
    }
    return state;
  });

  if (!alreadyVisited) {
    void taskEventTownVisited(townId);
    analyticsSendDesignEvent(
      `Town:Visit:${analyticsSafeSegment(town?.name ?? townId)}`,
    );
  }
}
