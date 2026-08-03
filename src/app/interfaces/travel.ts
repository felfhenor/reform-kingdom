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
