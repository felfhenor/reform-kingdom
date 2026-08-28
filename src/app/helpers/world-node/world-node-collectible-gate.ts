import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { notifySuccess } from '@helpers/engine/notify';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
} from '@helpers/world-node/world-node-discovery';
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
): void {
  if (worldNodeCollectibleGateIds(entry).length === 0) return;
  if (isWorldNodeHidden(entry)) return;
  if (isWorldNodeDiscovered(entry.nodeName)) return;
  if (!isWorldNodeCollectibleGateMet(entry)) return;

  worldNodeDiscover(entry.nodeName);
  miscellaneousMessageLog(`**${entry.nodeName}** is now accessible.`);
  notifySuccess(`${entry.nodeName} is now accessible.`);
}
