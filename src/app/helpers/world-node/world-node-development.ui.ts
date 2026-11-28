import { contentName } from '@helpers/i18n/i18n-content';
import { t } from '@helpers/i18n/i18n';
import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import { isPartyAtNode } from '@helpers/world';
import {
  worldNodeDevelopable,
  worldNodeDevelopmentBegin,
} from '@helpers/world-node/world-node-development-state';
import { WORLD_NODE_TYPE_BY_CONTENT_TYPE } from '@interfaces';

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
      ? t('worldNodeDevelopment.thePartyHasBegun', {
          name: contentName(content),
        })
      : t('worldNodeDevelopment.thePartyHasBegun2', {
          name: contentName(content),
          targetLevel,
        }),
  );
  analyticsSendDesignEvent(
    `World:${WORLD_NODE_TYPE_BY_CONTENT_TYPE[content.__type]}:LevelUp:${analyticsSafeSegment(nodeName)}`,
  );
  return true;
}
