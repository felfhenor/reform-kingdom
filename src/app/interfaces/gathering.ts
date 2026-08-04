import type { GatheringId } from '@interfaces/content-gathering';

export type GatheringStatus = 'Idle' | 'Gathering';

export type GatheringState = {
  status: GatheringStatus;
  nodeName?: string;
  gatheringId?: GatheringId;
  ticksIntoGather: number;
};
