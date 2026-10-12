import { gatherNodeLevelsState } from '@helpers/state-game';
import type {
  CostItem,
  GameStateGatherNodeLevels,
  GatheringContent,
} from '@interfaces';

// Absent entry (or a missing gatherNodeLevels, e.g. mid-migration on an old save) means level 0.
export function worldNodeLevel(nodeName: string): number {
  return gatherNodeLevelsState()?.[nodeName]?.level ?? 0;
}

// Level 0 is free, so each levelCost entry buys one level above it.
export function worldNodeMaxAchievableLevel(
  gathering: GatheringContent,
): number {
  return gathering.levelCost.length;
}

export function worldNodeIsMaxLevel(
  gathering: GatheringContent,
  nodeName: string,
): boolean {
  return worldNodeLevel(nodeName) >= worldNodeMaxAchievableLevel(gathering);
}

// Leveling N -> N+1 costs whatever's authored at levelCost[N] (gold + zone materials).
export function worldNodeLevelUpCost(
  gathering: GatheringContent,
  nodeName: string,
): CostItem[] {
  return gathering.levelCost[worldNodeLevel(nodeName)]?.costs ?? [];
}

// Drops entries whose node no longer resolves, and clamps to the current max achievable level.
export function pruneInvalidGatherNodeLevels(
  levels: GameStateGatherNodeLevels,
  gatheringForNode: (nodeName: string) => GatheringContent | undefined,
): GameStateGatherNodeLevels {
  const pruned: GameStateGatherNodeLevels = {};

  Object.keys(levels).forEach((nodeName) => {
    const gathering = gatheringForNode(nodeName);
    if (!gathering) return;

    pruned[nodeName] = {
      level: Math.min(
        levels[nodeName].level,
        worldNodeMaxAchievableLevel(gathering),
      ),
    };
  });

  return pruned;
}
