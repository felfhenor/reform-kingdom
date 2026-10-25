import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { gatherVfxEmit } from '@helpers/engine/gather-vfx';
import { notifySuccess } from '@helpers/engine/notify';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
} from '@helpers/world-node/world-node-discovery';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import {
  isWorldNodeCollectibleGateMet,
  isWorldNodeHidden,
  worldNodeCollectibleGateIds,
} from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

// Split out of world-nodes.ts so its pure lookups stay free of combat-log/notify.
// Reuses the discovery ledger to dedupe; skipped when also `hidden` so a click still owns the reveal.
export function worldNodeDiscoverIfCollectibleGateMet(
  entry: WorldNodeEntry,
): boolean {
  const gateIds = worldNodeCollectibleGateIds(entry);
  if (gateIds.length === 0) return false;
  if (isWorldNodeHidden(entry)) return false;
  if (isWorldNodeDiscovered(entry.nodeName)) return false;
  if (!isWorldNodeCollectibleGateMet(entry)) return false;

  worldNodeDiscover(entry.nodeName);
  miscellaneousMessageLog(`**${entry.nodeName}** is now accessible.`);
  notifySuccess(`${entry.nodeName} is now accessible.`);

  gateIds.forEach((collectibleId) => {
    const info = rewardContentInfo({ collectibleId });
    if (info) gatherVfxEmit({ nodeName: entry.nodeName, ...info });
  });

  return true;
}
