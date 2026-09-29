import { OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL } from '@helpers/config';
import { outpostsState } from '@helpers/state-game';

// Absent entry (or a missing outposts slice, e.g. mid-migration on an old save) means unbuilt.
export function worldNodeOutpostLevel(nodeName: string): number {
  return outpostsState()?.[nodeName]?.level ?? 0;
}

export function isOutpostBuilt(nodeName: string): boolean {
  return worldNodeOutpostLevel(nodeName) >= 1;
}

// The build itself (+1) grants no reduction; safe to call with any node name, since non-outposts read as unbuilt.
export function outpostDeathPenaltyMultiplier(nodeName: string): number {
  const upgrades = Math.max(0, worldNodeOutpostLevel(nodeName) - 1);
  return Math.max(0, 1 - upgrades * OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL);
}
