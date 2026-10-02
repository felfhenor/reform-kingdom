import {
  OUTPOST_DEATH_PENALTY_MAX_LEVEL,
  OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL,
  OUTPOST_TELEPORT_LEVEL,
} from '@helpers/config';
import { outpostsState } from '@helpers/state-game';
import {
  isWorldNodeVisible,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type { WorldNodeEntry } from '@interfaces';

// Absent entry (or a missing outposts slice, e.g. mid-migration on an old save) means unbuilt.
export function worldNodeOutpostLevel(nodeName: string): number {
  return outpostsState()?.[nodeName]?.level ?? 0;
}

export function isOutpostBuilt(nodeName: string): boolean {
  return worldNodeOutpostLevel(nodeName) >= 1;
}

// The build itself (+1) grants no reduction; safe to call with any node name, since non-outposts read as unbuilt.
export function outpostDeathPenaltyMultiplier(nodeName: string): number {
  const level = Math.min(
    worldNodeOutpostLevel(nodeName),
    OUTPOST_DEATH_PENALTY_MAX_LEVEL,
  );
  const upgrades = Math.max(0, level - 1);
  return Math.max(0, 1 - upgrades * OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL);
}

export function isOutpostTeleportUnlocked(nodeName: string): boolean {
  return worldNodeOutpostLevel(nodeName) >= OUTPOST_TELEPORT_LEVEL;
}

// Building one requires standing there, so built doubles as "visited" and keeps unexplored outposts off the list.
export function isOutpostTeleportListed(entry: WorldNodeEntry): boolean {
  return isWorldNodeVisible(entry) && isOutpostBuilt(entry.nodeName);
}

export function outpostsWithTeleportUnlocked(): WorldNodeEntry[] {
  return worldNodesOfType('Outpost').filter(
    (entry) =>
      isOutpostTeleportListed(entry) &&
      isOutpostTeleportUnlocked(entry.nodeName),
  );
}
