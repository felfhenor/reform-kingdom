import { shrinesState } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  CostItem,
  GameStateShrineLevels,
  ShrineContent,
  ShrineLevel,
} from '@interfaces';

// Absent entry (or a missing shrines slice, e.g. mid-migration on an old save) means level 0.
export function worldNodeShrineLevel(nodeName: string): number {
  return shrinesState()?.[nodeName]?.level ?? 0;
}

// Level 0 means no investment made yet (not a tier); levels.length is the highest tier obtainable.
export function worldNodeShrineMaxAchievableLevel(
  shrine: ShrineContent,
): number {
  return shrine.levels.length;
}

export function worldNodeShrineIsMaxLevel(
  shrine: ShrineContent,
  nodeName: string,
): boolean {
  return (
    worldNodeShrineLevel(nodeName) >= worldNodeShrineMaxAchievableLevel(shrine)
  );
}

// Leveling N -> N+1 costs whatever's authored at levels[N] - every entry's cost gets used, since levels.length is the max achievable level.
export function worldNodeShrineLevelUpCost(
  shrine: ShrineContent,
  nodeName: string,
): CostItem[] {
  return shrine.levels[worldNodeShrineLevel(nodeName)]?.costs ?? [];
}

// Level N grants levels[N-1]'s buff - level 0 has no tier, so the shrine requires an initial investment before it's prayable.
export function worldNodeShrineCurrentTier(
  shrine: ShrineContent,
  nodeName: string,
): ShrineLevel | undefined {
  return shrine.levels[worldNodeShrineLevel(nodeName) - 1];
}

// developing/praying requires physically standing at the node.
export function isPartyAtShrine(nodeName: string): boolean {
  return worldNodeAtCurrentLocation()?.nodeName === nodeName;
}

// Drops entries whose node no longer resolves, and clamps to the current max achievable level.
export function pruneInvalidShrineLevels(
  levels: GameStateShrineLevels,
  shrineForNode: (nodeName: string) => ShrineContent | undefined,
): GameStateShrineLevels {
  const pruned: GameStateShrineLevels = {};

  Object.keys(levels).forEach((nodeName) => {
    const shrine = shrineForNode(nodeName);
    if (!shrine) return;

    pruned[nodeName] = {
      level: Math.min(
        levels[nodeName].level,
        worldNodeShrineMaxAchievableLevel(shrine),
      ),
    };
  });

  return pruned;
}
