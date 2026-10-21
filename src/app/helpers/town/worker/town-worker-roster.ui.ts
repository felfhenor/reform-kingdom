import { getEntry } from '@helpers/content/content';
import { formatDuration } from '@helpers/engine/timer';
import { travelTicksRemaining } from '@helpers/hero/travel-progress';
import { worldTownsState } from '@helpers/state-game';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  CurrentLocation,
  TownContent,
  TownId,
  TownWorkerRosterEntry,
  TownWorkerStatus,
  TownWorkerStatusDisplay,
  WorkerContent,
  WorkerId,
} from '@interfaces';

export function townWorkerRosterEntries(
  townId: TownId,
): TownWorkerRosterEntry[] {
  const workers = worldTownsState()[townId]?.workers ?? {};

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const content = getEntry<WorkerContent>(workerId);
      if (!content) return undefined;

      const state = workers[workerId];
      return {
        workerId,
        name: content.name,
        sprite: content.sprite,
        frames: content.frames,
        level: state.level,
        location: state.location,
        status: state.status,
      };
    })
    .filter((entry): entry is TownWorkerRosterEntry => !!entry);
}

// A label plus the node the worker is currently at (or heading to/returning to).
export function townWorkerStatusDisplay(
  town: TownContent,
  status: TownWorkerStatus,
  location: CurrentLocation,
): TownWorkerStatusDisplay {
  const atTownEntry = worldNodeByName(town.name);

  switch (status.kind) {
    case 'TravelingTo': {
      const remaining = travelTicksRemaining(
        status.path,
        location,
        status.ticksIntoStep,
      );
      return {
        label: `Traveling to ${status.nodeName} (${formatDuration(remaining)} remaining)`,
        locationEntry: worldNodeByName(status.nodeName),
      };
    }
    case 'Gathering':
      return {
        label: `Gathering at ${status.nodeName}`,
        locationEntry: worldNodeByName(status.nodeName),
      };
    case 'Resting':
      return { label: 'Resting', locationEntry: atTownEntry };
    case 'TravelingBack': {
      const remaining = travelTicksRemaining(
        status.path,
        location,
        status.ticksIntoStep,
      );
      return {
        label: `Returning to town (${formatDuration(remaining)} remaining)`,
        locationEntry: atTownEntry,
      };
    }
    case 'AtTown':
      return { label: 'At Town', locationEntry: atTownEntry };
  }
}
