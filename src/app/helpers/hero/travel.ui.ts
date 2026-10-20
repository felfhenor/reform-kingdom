import { canPartyTravel } from '@helpers/hero/travel';
import { canEnterGatherNode } from '@helpers/item/gathering';
import { travelPathTo } from '@helpers/pathfinding/pathfinding-travel';
import { worldTravelState } from '@helpers/state-game';
import { worldNodeCaravanIsAvailable } from '@helpers/world-node/world-node-caravan.ui';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

export function travelCanStartTo(entry: WorldNodeEntry): boolean {
  const path = travelPathTo(entry.nodeName);
  const travel = worldTravelState();
  const isTraveling = travel.status === 'Traveling';
  if (!path || (path.length === 0 && !isTraveling)) return false;
  if (isTraveling && travel.destinationNodeName === entry.nodeName)
    return false;

  return (
    canPartyTravel() &&
    canEnterGatherNode(entry.nodeName) &&
    (!worldNodeCaravan(entry) || worldNodeCaravanIsAvailable(entry))
  );
}
