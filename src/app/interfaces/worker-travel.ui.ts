import type { WorkerId } from '@interfaces/content-worker';
import type { CurrentLocation } from '@interfaces/state-game';
import type { TravelStep } from '@interfaces/travel';

// One traveling kingdom or town worker on the map; `key` is unique across both rosters.
export type WorkerTravelToken = {
  key: string;
  workerId: WorkerId;
  location: CurrentLocation;
  path: TravelStep[];
  ticksIntoStep: number;
};
