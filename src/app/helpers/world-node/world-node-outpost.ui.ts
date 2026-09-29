import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
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
import { worldNodeOutpostLevel } from '@helpers/world-node/world-node-outpost';
import {
  worldNodeByName,
  worldNodeOutpost,
} from '@helpers/world-node/world-nodes';

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
