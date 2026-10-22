import type { WorkerId } from '@interfaces/content-worker';
import type { CurrentLocation } from '@interfaces/state-game';
import type {
  WorkerGatherAssignment,
  WorkerStatus,
  WorkerTripStatus,
} from '@interfaces/worker-state';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

// Town workers only gather, so a craft assignment can't reach one.
export type TownWorkerAssignment = WorkerGatherAssignment;

export type TownWorkerStatusAtTown = {
  kind: 'AtTown';
};

export type TownWorkerStatusResting = {
  kind: 'Resting';
  ticksIntoRest: number;
};

export type TownWorkerStatus =
  TownWorkerStatusAtTown | WorkerTripStatus | TownWorkerStatusResting;

export type TownWorkerState = {
  level: number;

  // The worker's own tracked tile, independent of the town's own map location.
  location: CurrentLocation;

  status: TownWorkerStatus;
  assignment: TownWorkerAssignment | null;
};

// Readonly status: shared tick logic may edit one in place but never swap it, since the two status unions differ.
export type AnyWorkerState = {
  location: CurrentLocation;
  readonly status: WorkerStatus | TownWorkerStatus;
};

// Display-only shape for one roster row - rendered by the Workers tab.
export type TownWorkerRosterEntry = {
  workerId: WorkerId;
  name: string;
  sprite: string;
  frames: number;
  level: number;
  location: CurrentLocation;
  status: TownWorkerStatus;
};

// Status label + the node the worker is currently at (or heading to/returning to).
export type TownWorkerStatusDisplay = {
  label: string;
  locationEntry?: WorldNodeEntry;
};
