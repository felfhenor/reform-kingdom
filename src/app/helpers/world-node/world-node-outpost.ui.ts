import { categoryMessageLog } from '@helpers/combat/combat-log';
import {
  autoModeIsEnabled,
  autoModeToggle,
} from '@helpers/decree/auto-mode-state';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { travelRelocateTo } from '@helpers/hero/travel';
import {
  isOutpostTeleportListed,
  isOutpostTeleportUnlocked,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import { outpostCanTeleport } from '@helpers/world-node/world-node-outpost-teleport';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
import type { OutpostTeleportRow, WorldNodeEntry } from '@interfaces';

export function outpostTeleportRows(
  from: WorldNodeEntry,
): OutpostTeleportRow[] {
  return worldNodesOfType('Outpost')
    .filter((entry) => isOutpostTeleportListed(entry))
    .map((entry) => ({
      entry,
      level: worldNodeOutpostLevel(entry.nodeName),
      isCurrent: entry.nodeName === from.nodeName,
      isUnlocked: isOutpostTeleportUnlocked(entry.nodeName),
      canTeleport: outpostCanTeleport(from, entry),
    }));
}

// Manual-only like a travel click, so it hands control back from Auto Mode.
export function outpostTeleport(
  from: WorldNodeEntry,
  to: WorldNodeEntry,
): boolean {
  if (!outpostCanTeleport(from, to)) return false;

  if (autoModeIsEnabled()) autoModeToggle(false);
  travelRelocateTo(to);

  categoryMessageLog(
    'Travel',
    to.mapName,
    `The party teleported from ${from.nodeName} to ${to.nodeName}.`,
  );
  analyticsSendDesignEvent(
    `World:Outpost:Teleport:${analyticsSafeSegment(to.nodeName)}`,
  );
  return true;
}
