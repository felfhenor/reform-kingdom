import type { ItemId } from '@interfaces/content-item';
import type { WorkerId } from '@interfaces/content-worker';
import type { CurrentLocation } from '@interfaces/state-game';
import type { TravelStep } from '@interfaces/travel';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

export type TownWorkerAssignment = {
  nodeName: string;
  itemId: ItemId;
};

export type TownWorkerStatusAtTown = {
  kind: 'AtTown';
};

export type TownWorkerStatusTravelingTo = {
  kind: 'TravelingTo';
  nodeName: string;
  itemId: ItemId;
  path: TravelStep[];
  ticksIntoStep: number;
};

export type TownWorkerStatusGathering = {
  kind: 'Gathering';
  nodeName: string;
  itemId: ItemId;
  itemsGathered: number;
  ticksIntoGather: number;
};

export type TownWorkerStatusResting = {
  kind: 'Resting';
  ticksIntoRest: number;
};

export type TownWorkerStatusTravelingBack = {
  kind: 'TravelingBack';
  path: TravelStep[];
  ticksIntoStep: number;
  carriedItemId?: ItemId;
  carriedQuantity: number;
};

export type TownWorkerStatus =
  | TownWorkerStatusAtTown
  | TownWorkerStatusTravelingTo
  | TownWorkerStatusGathering
  | TownWorkerStatusResting
  | TownWorkerStatusTravelingBack;

export type TownWorkerState = {
  level: number;

  // The worker's own tracked tile, independent of the town's own map location.
  location: CurrentLocation;

  status: TownWorkerStatus;
  assignment: TownWorkerAssignment | null;
};

// Display-only shape for one roster row - rendered by the Workers tab.
export type TownWorkerRosterEntry = {
  workerId: WorkerId;
  name: string;
  sprite: string;
  frames: number;
  level: number;
  status: TownWorkerStatus;
};

// Status label + the node the worker is currently at (or heading to/returning to).
export type TownWorkerStatusDisplay = {
  label: string;
  locationEntry?: WorldNodeEntry;
};
