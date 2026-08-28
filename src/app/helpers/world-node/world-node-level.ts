import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { hasGold, spendGold } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type { GameStateGatherNodeLevels, GatheringContent } from '@interfaces';

// Absent entry (or a missing gatherNodeLevels, e.g. mid-migration on an old save) means level 0.
export function worldNodeLevel(nodeName: string): number {
  return gamestate().gatherNodeLevels?.[nodeName]?.level ?? 0;
}

// maxLevel is a tier count (levelRequirement is authored 0..maxLevel-1), not a level value itself.
export function worldNodeMaxAchievableLevel(
  gathering: GatheringContent,
): number {
  return gathering.maxLevel - 1;
}

export function worldNodeIsMaxLevel(
  gathering: GatheringContent,
  nodeName: string,
): boolean {
  return worldNodeLevel(nodeName) >= worldNodeMaxAchievableLevel(gathering);
}

// Leveling N -> N+1 costs levelCostScalar * (N+1).
export function worldNodeLevelUpCost(
  gathering: GatheringContent,
  nodeName: string,
): number {
  return gathering.levelCostScalar * (worldNodeLevel(nodeName) + 1);
}

// Mirrors isPartyAtCaravan (caravan.ts) - leveling requires physically standing at the node.
export function isPartyAtGatherNode(nodeName: string): boolean {
  return worldNodeAtCurrentLocation()?.nodeName === nodeName;
}

export function gatherNodeLevelUp(nodeName: string): boolean {
  const node = worldNodeByName(nodeName);
  if (!node) return false;

  const gathering = worldNodeGathering(node);
  if (!gathering) return false;

  if (worldNodeIsMaxLevel(gathering, nodeName)) return false;
  if (!isPartyAtGatherNode(nodeName)) return false;

  const cost = worldNodeLevelUpCost(gathering, nodeName);
  if (!hasGold(cost)) return false;

  updateGamestate((state) => {
    spendGold(state, cost);

    const existing = state.gatherNodeLevels[nodeName];
    state.gatherNodeLevels[nodeName] = { level: (existing?.level ?? 0) + 1 };
    return state;
  });

  analyticsSendDesignEvent(
    `World:GatherNode:LevelUp:${analyticsSafeSegment(nodeName)}`,
  );
  return true;
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
