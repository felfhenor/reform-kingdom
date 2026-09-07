import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { hasGold, spendGold } from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import {
  isPartyAtGatherNode,
  worldNodeIsMaxLevel,
  worldNodeLevelUpCost,
} from '@helpers/world-node/world-node-level';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';

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
