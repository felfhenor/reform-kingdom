import { gatheringEffectiveGatherTime } from '@helpers/world-node/world-node-gathering';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import { worldNodeGathering } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

export function worldNodeGatherTime(entry: WorldNodeEntry): number | undefined {
  const gathering = worldNodeGathering(entry);
  if (!gathering) return undefined;

  return gatheringEffectiveGatherTime(
    gathering,
    worldNodeLevel(entry.nodeName),
  );
}
