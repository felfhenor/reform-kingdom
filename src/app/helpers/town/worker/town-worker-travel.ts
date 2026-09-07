import type { Signal } from '@angular/core';
import { computed } from '@angular/core';
import { getEntry } from '@helpers/content/content';
import { travelPathTotalTicks } from '@helpers/hero/travel';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townWorkerStatsForLevel } from '@helpers/town/worker/town-worker-progression';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  ItemId,
  TownContent,
  TownId,
  TownWorkerAssignment,
  TravelStep,
  WorkerContent,
  WorkerId,
} from '@interfaces';

function gatherNodeHasItem(nodeName: string, itemId: ItemId): boolean {
  const node = worldNodeByName(nodeName);
  const gathering = node ? worldNodeGathering(node) : undefined;
  if (!gathering) return false;

  return gatheringResultsAtLevel(gathering, worldNodeLevel(nodeName)).some(
    (result) => result.items.some((item) => item.itemId === itemId),
  );
}

// Cost from the town's own node, not the Kingdom.
export function townWorkerStaminaCostToNode(
  town: TownContent,
  nodeName: string,
): number | undefined {
  const townNode = worldNodeByName(town.name);
  if (!townNode) return undefined;

  const path = travelPathFrom(townNode, nodeName);
  return path ? travelPathTotalTicks(path, townNode) : undefined;
}

// No discovery check - town workers are NPC-run, not player exploration.
export function townWorkerAssignmentIsValid(
  town: TownContent,
  workerId: WorkerId,
  level: number,
  assignment: TownWorkerAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  if (!content) return false;

  const stamina = townWorkerStatsForLevel(content, level).stamina;
  const cost = townWorkerStaminaCostToNode(town, assignment.nodeName);

  return (
    gatherNodeHasItem(assignment.nodeName, assignment.itemId) &&
    cost !== undefined &&
    cost <= stamina
  );
}

// Always computed fresh from the town's own node - no-ops (leaves the worker AtTown) if no route resolves.
export function townWorkerBeginOutboundTrip(
  townId: TownId,
  town: TownContent,
  workerId: WorkerId,
  assignment: TownWorkerAssignment,
): void {
  const townNode = worldNodeByName(town.name);
  if (!townNode) return;

  const path = travelPathFrom(townNode, assignment.nodeName);
  if (!path) return;

  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    target.assignment = assignment;
    target.status = {
      kind: 'TravelingTo',
      nodeName: assignment.nodeName,
      itemId: assignment.itemId,
      path,
      ticksIntoStep: 0,
    };
    return state;
  });
}

// Starts the trip home from the worker's current location - parks AtTown with cargo discarded if no route resolves.
export function townWorkerBeginReturnTrip(
  townId: TownId,
  town: TownContent,
  workerId: WorkerId,
  carriedItemId: ItemId | undefined,
  carriedQuantity: number,
): void {
  updateGamestate((state) => {
    const target = state.world.towns[townId]?.workers[workerId];
    if (!target) return state;

    const path = travelPathFrom(target.location, town.name);

    target.status = path
      ? {
          kind: 'TravelingBack',
          path,
          ticksIntoStep: 0,
          carriedItemId,
          carriedQuantity,
        }
      : { kind: 'AtTown' };
    return state;
  });
}

// Read every animation frame by the PIXI map-rendering layer - a separate signal
// (not a merged one) since state lives at world.towns[townId].workers, not workers.
export const townWorkersTravelingTokens: Signal<
  {
    townId: TownId;
    workerId: WorkerId;
    mapName: string;
    path: TravelStep[];
    ticksIntoStep: number;
  }[]
> = computed(() => {
  const towns = gamestate().world.towns;

  return (Object.keys(towns) as TownId[]).flatMap((townId) => {
    const workers = towns[townId].workers;

    return (Object.keys(workers) as WorkerId[])
      .map((workerId) => {
        const worker = workers[workerId];
        if (
          worker.status.kind !== 'TravelingTo' &&
          worker.status.kind !== 'TravelingBack'
        ) {
          return undefined;
        }

        return {
          townId,
          workerId,
          mapName: worker.location.mapName,
          path: worker.status.path,
          ticksIntoStep: worker.status.ticksIntoStep,
        };
      })
      .filter((token): token is NonNullable<typeof token> => !!token);
  });
});
