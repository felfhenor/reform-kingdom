import {
  OUTPOST_DEATH_PENALTY_MAX_LEVEL,
  OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL,
  OUTPOST_TELEPORT_LEVEL,
} from '@helpers/config';
import { globalEffectSumsState, outpostsState } from '@helpers/state-game';
import {
  isWorldNodeMapVisited,
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

// Scales Deaths Door and Healing: the home outpost's reduction times any global effect, never negative.
export function deathPenaltyMultiplier(homeNodeName?: string): number {
  const outpost = homeNodeName
    ? outpostDeathPenaltyMultiplier(homeNodeName)
    : 1;
  const bonus = globalEffectSumsState().deathPenaltyMultiplierBonus;
  return outpost * Math.max(0, 1 + bonus);
}

export function isOutpostTeleportUnlocked(nodeName: string): boolean {
  return worldNodeOutpostLevel(nodeName) >= OUTPOST_TELEPORT_LEVEL;
}

// Edicts can build outposts at world start, so being built alone doesn't prove the party has been there.
export function isOutpostTeleportListed(entry: WorldNodeEntry): boolean {
  return (
    isWorldNodeVisible(entry) &&
    isWorldNodeMapVisited(entry.nodeName) &&
    isOutpostBuilt(entry.nodeName)
  );
}

export function outpostsWithTeleportUnlocked(): WorldNodeEntry[] {
  return worldNodesOfType('Outpost').filter(
    (entry) =>
      isOutpostTeleportUnlocked(entry.nodeName) &&
      isOutpostTeleportListed(entry),
  );
}
