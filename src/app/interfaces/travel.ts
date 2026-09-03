import type { CurrentLocation } from '@interfaces/state-game';

export type TravelStatus = 'Idle' | 'Traveling';

export type TravelStepKind = 'Move' | 'Teleport';

export type TravelStep = {
  kind: TravelStepKind;
  mapName: string;
  x: number;
  y: number;
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
