import { gamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  CostItem,
  GameStateGatherNodeLevels,
  GatheringContent,
} from '@interfaces';

// Absent entry (or a missing gatherNodeLevels, e.g. mid-migration on an old save) means level 0.
export function worldNodeLevel(nodeName: string): number {
  return gamestate().gatherNodeLevels?.[nodeName]?.level ?? 0;
}

// levelCost.length is the tier count (levelRequirement is authored 0..length-1), not a level value itself.
export function worldNodeMaxAchievableLevel(
  gathering: GatheringContent,
): number {
  return gathering.levelCost.length - 1;
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

// Mirrors isPartyAtCaravan (caravan.ts) - leveling requires physically standing at the node.
export function isPartyAtGatherNode(nodeName: string): boolean {
  return worldNodeAtCurrentLocation()?.nodeName === nodeName;
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
