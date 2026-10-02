import {
  categoryMessageLog,
  miscellaneousMessageLog,
} from '@helpers/combat/combat-log';
import {
  autoModeIsEnabled,
  autoModeToggle,
} from '@helpers/decree/auto-mode-state';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { travelRelocateTo } from '@helpers/hero/travel';
import { updateGamestate } from '@helpers/state-game';
import { isPartyAtNode } from '@helpers/world';
import {
  worldNodeCanAffordCost,
  worldNodeSpendCost,
} from '@helpers/world-node/world-node-cost';
import {
  worldNodeDevelopmentIsMaxLevel,
  worldNodeDevelopmentLevelUpCost,
} from '@helpers/world-node/world-node-development';
import {
  isOutpostTeleportListed,
  isOutpostTeleportUnlocked,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import { outpostCanTeleport } from '@helpers/world-node/world-node-outpost-teleport';
import {
  worldNodeByName,
  worldNodeOutpost,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { OutpostTeleportRow, WorldNodeEntry } from '@interfaces';

// Re-validated inside the callback so a double-click can't pay a stale level's cost twice.
export async function outpostLevelUp(nodeName: string): Promise<boolean> {
  const node = worldNodeByName(nodeName);
  const outpost = node ? worldNodeOutpost(node) : undefined;
  if (!outpost || !isPartyAtNode(nodeName)) return false;

  let newLevel = 0;
  await updateGamestate((state) => {
    const level = worldNodeOutpostLevel(nodeName);
    if (worldNodeDevelopmentIsMaxLevel(outpost, level)) return state;

    const cost = worldNodeDevelopmentLevelUpCost(outpost, level);
    if (!worldNodeCanAffordCost(cost)) return state;

    worldNodeSpendCost(state, cost);
    newLevel = level + 1;
    state.outposts[nodeName] = { level: newLevel };
    return state;
  });

  if (newLevel === 0) return false;

  miscellaneousMessageLog(
    newLevel === 1
      ? `The party has built **${outpost.name}**.`
      : `The party has developed **${outpost.name}** to +${newLevel}.`,
  );
  analyticsSendDesignEvent(
    `World:Outpost:LevelUp:${analyticsSafeSegment(outpost.name)}`,
  );
  return true;
}

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
