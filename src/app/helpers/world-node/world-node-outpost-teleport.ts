import { canPartyTravel } from '@helpers/hero/travel';
import { isPartyAtNode } from '@helpers/world';
import {
  isOutpostBuilt,
  isOutpostTeleportUnlocked,
} from '@helpers/world-node/world-node-outpost';
import { isWorldNodeVisible } from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

// Building one requires standing there, so built doubles as "visited" and keeps unexplored outposts off the list.
export function isOutpostTeleportListed(entry: WorldNodeEntry): boolean {
  return isWorldNodeVisible(entry) && isOutpostBuilt(entry.nodeName);
}

export function outpostCanTeleport(
  from: WorldNodeEntry,
  to: WorldNodeEntry,
): boolean {
  return (
    from.nodeName !== to.nodeName &&
    isOutpostTeleportListed(to) &&
    isOutpostTeleportUnlocked(from.nodeName) &&
    isOutpostTeleportUnlocked(to.nodeName) &&
    isPartyAtNode(from.nodeName) &&
    canPartyTravel()
  );
}
