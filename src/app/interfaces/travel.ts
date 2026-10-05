import type { CurrentLocation } from '@interfaces/state-game';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

export type TravelStatus = 'Idle' | 'Traveling';

export type TravelStepKind = 'Move' | 'Teleport';

// Which outposts act as hops: none, the save's +5 ones, or every Outpost node as if +5 (content-only tooling).
export type OutpostRouting = 'None' | 'Unlocked' | 'AllMaxed';

export type TravelStep = {
  kind: TravelStepKind;
  mapName: string;
  x: number;
  y: number;
};

// Route-graph hop: walk onto `gateway`, then land on any one of `arrivals`.
export type TravelRouteEdge = {
  gateway: WorldNodeEntry;
  arrivals: WorldNodeEntry[];
};

export type TravelState = {
  status: TravelStatus;
  destinationNodeName?: string;
  path: TravelStep[];
  ticksIntoStep: number;
};

// Result of advancing one tick along a path - shared shape for any single-entity path-follower
export type PathAdvanceResult =
  | { arrived: true; location: CurrentLocation }
  | {
      arrived: false;
      path: TravelStep[];
      ticksIntoStep: number;
      location: CurrentLocation;
    };
