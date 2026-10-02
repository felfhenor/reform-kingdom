import { canPartyTravel } from '@helpers/hero/travel';
import { isPartyAtNode } from '@helpers/world';
import {
  isOutpostTeleportListed,
  isOutpostTeleportUnlocked,
} from '@helpers/world-node/world-node-outpost';
import type { WorldNodeEntry } from '@interfaces';

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
