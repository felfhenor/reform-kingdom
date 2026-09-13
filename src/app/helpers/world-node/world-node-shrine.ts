import { gamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  CostItem,
  GameStateShrineLevels,
  ShrineContent,
  ShrineLevel,
} from '@interfaces';

// Absent entry (or a missing shrines slice, e.g. mid-migration on an old save) means level 0.
export function worldNodeShrineLevel(nodeName: string): number {
  return gamestate().shrines?.[nodeName]?.level ?? 0;
}

export function worldNodeShrineMaxAchievableLevel(
  shrine: ShrineContent,
): number {
  return shrine.levels.length - 1;
}

export function worldNodeShrineIsMaxLevel(
  shrine: ShrineContent,
  nodeName: string,
): boolean {
  return (
    worldNodeShrineLevel(nodeName) >= worldNodeShrineMaxAchievableLevel(shrine)
  );
}

// Leveling N -> N+1 costs whatever's authored at levels[N] (levels[length-1]'s own costs are unused once maxed).
export function worldNodeShrineLevelUpCost(
  shrine: ShrineContent,
  nodeName: string,
): CostItem[] {
  return shrine.levels[worldNodeShrineLevel(nodeName)]?.costs ?? [];
}

// Level N directly grants levels[N]'s buff - level 0 already grants tier I for free.
export function worldNodeShrineCurrentTier(
  shrine: ShrineContent,
  nodeName: string,
): ShrineLevel | undefined {
  return shrine.levels[worldNodeShrineLevel(nodeName)];
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
