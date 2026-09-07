import { worldNodeGathering } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

export function worldNodeGatherTime(entry: WorldNodeEntry): number | undefined {
  return worldNodeGathering(entry)?.gatherTime;
}
