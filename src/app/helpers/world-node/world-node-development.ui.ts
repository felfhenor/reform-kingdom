import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import { isPartyAtNode } from '@helpers/world';
import {
  WORLD_NODE_DEVELOPMENT_ANALYTICS_SEGMENTS,
  worldNodeDevelopable,
  worldNodeDevelopmentBegin,
} from '@helpers/world-node/world-node-development-state';

// Re-validated inside the callback so a double-click can't pay twice.
export async function worldNodeDevelopStart(
  nodeName: string,
): Promise<boolean> {
  const content = worldNodeDevelopable(nodeName);
  if (!content || !isPartyAtNode(nodeName)) return false;

  let targetLevel = 0;
  await updateGamestate((state) => {
    targetLevel = worldNodeDevelopmentBegin(state, nodeName, content);
    return state;
  });
  if (targetLevel === 0) return false;

  miscellaneousMessageLog(
    content.__type === 'outpost' && targetLevel === 1
      ? `The party has begun building **${content.name}**.`
      : `The party has begun developing **${content.name}** to +${targetLevel}.`,
  );
  analyticsSendDesignEvent(
    `World:${WORLD_NODE_DEVELOPMENT_ANALYTICS_SEGMENTS[content.__type]}:LevelUp:${analyticsSafeSegment(nodeName)}`,
  );
  return true;
}
