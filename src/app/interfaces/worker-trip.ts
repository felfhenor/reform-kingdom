import type { ItemId } from '@interfaces/content-item';
import type { WorkerId } from '@interfaces/content-worker';
import type { CurrentLocation, GameState } from '@interfaces/state-game';
import type { TownWorkerState } from '@interfaces/town-worker-state';
import type { TravelStep } from '@interfaces/travel';
import type {
  WorkerGatherAssignment,
  WorkerState,
  WorkerTripStatus,
} from '@interfaces/worker-state';

export type WorkerTripWorker = WorkerState | TownWorkerState;

export type WorkerTripCargo = {
  itemId?: ItemId;
  quantity: number;
};

// One worker's view for the shared trip engine; each roster supplies where its state lives and what's roster-specific.
export type WorkerTripHost<W extends WorkerTripWorker> = {
  workerId: WorkerId;
  read: () => W | undefined;
  draft: (state: GameState) => W | undefined;
  setStatus: (worker: W, status: WorkerTripStatus | 'idle') => void;
  setAssignment: (worker: W, assignment: WorkerGatherAssignment | null) => void;
  assignmentIsValid: (
    level: number,
    assignment: WorkerGatherAssignment,
  ) => boolean;
  pathTo: (
    nodeName: string,
    canUseTeleports: boolean,
  ) => TravelStep[] | undefined;
  pathHome: (
    from: CurrentLocation,
    canUseTeleports: boolean,
  ) => TravelStep[] | undefined;
  gatherRateMultiplier: number;
  onUnitGathered?: (nodeName: string, itemId: ItemId, level: number) => void;
  onUnitBanked?: (nodeName: string, itemId: ItemId) => void;
  onArrivedHome: (
    cargo: WorkerTripCargo,
    pending: W['assignment'],
    level: number,
  ) => void;
};
