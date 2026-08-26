import type { WorkerId } from '@interfaces/content-worker';
import type { ItemId } from '@interfaces/content-item';
import type { CurrentLocation } from '@interfaces/state-game';
import type { TravelStep } from '@interfaces/travel';

export type WorkerAssignment = {
  nodeName: string;
  itemId: ItemId;
};

export type WorkerStatusAtDuchy = {
  kind: 'AtDuchy';
};

// A snapshot taken at trip-start, distinct from the live `WorkerState.assignment` -
// this is what makes "change assignment" apply only to the next trip.
export type WorkerStatusTravelingTo = {
  kind: 'TravelingTo';
  nodeName: string;
  itemId: ItemId;
  path: TravelStep[];
  ticksIntoStep: number;
};

export type WorkerStatusGathering = {
  kind: 'Gathering';
  nodeName: string;
  itemId: ItemId;
  itemsGathered: number;
  ticksIntoGather: number;
};

// XP is granted per unit as it's gathered, not held here - only the physical
// material is carried until delivery on arrival.
export type WorkerStatusTravelingBack = {
  kind: 'TravelingBack';
  path: TravelStep[];
  ticksIntoStep: number;
  carriedItemId?: ItemId;
  carriedQuantity: number;
};

export type WorkerStatus =
  | WorkerStatusAtDuchy
  | WorkerStatusTravelingTo
  | WorkerStatusGathering
  | WorkerStatusTravelingBack;

export type WorkerState = {
  level: number;
  xp: { current: number; maximum: number };

  // The worker's own tracked tile, independent of the hero party's `world.currentLocation`.
  location: CurrentLocation;

  status: WorkerStatus;
  assignment: WorkerAssignment | null;
};

export type GameStateWorkers = {
  [key: WorkerId]: WorkerState;
};

// Permanent "ever rescued" ledger, distinct from `GameStateWorkers` (live progress) -
// same discovery-ledger split as every other collectible-like system.
export type GameStateDiscoveredWorkers = {
  [key: WorkerId]: { foundAt: number };
};

// Display-only shape for one ready-to-level-up corner card - built by
// `workersReadyToLevelUpEntries`, rendered by `card-status-worker-levelup`.
export type WorkerLevelUpStatusEntry = {
  workerId: WorkerId;
  name: string;
  sprite: string;
  frames: number;
  level: number;
};
