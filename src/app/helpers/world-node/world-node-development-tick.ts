import { t } from '@helpers/i18n/i18n';
import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { desktopNotify } from '@helpers/engine/desktop-notify';
import { notifySuccess } from '@helpers/engine/notify';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate } from '@helpers/state-game';
import { taskEventShrineLevel } from '@helpers/task/task-events';
import {
  WORLD_NODE_DEVELOPMENT_SLICES,
  worldNodeDevelopmentsDue,
} from '@helpers/world-node/world-node-development-state';
import { applyOutpostBuffRefresh } from '@helpers/world-node/world-node-outpost-buff';
import type { WorldNodeDevelopmentDue } from '@interfaces';
import { WORLD_NODE_TYPE_BY_CONTENT_TYPE } from '@interfaces';

function worldNodeDevelopmentCompleteText(
  { content, level }: WorldNodeDevelopmentDue,
  name: string,
): string {
  return content.__type === 'outpost' && level === 1
    ? t('worldNodeDevelopmentTick.hasBeenBuilt', { name })
    : t('worldNodeDevelopmentTick.hasBeenDevelopedTo', { name, level });
}

function worldNodeDevelopmentAnnounce(due: WorldNodeDevelopmentDue): void {
  const { nodeName, content, level } = due;
  miscellaneousMessageLog(
    worldNodeDevelopmentCompleteText(due, `**${content.name}**`),
  );
  const completeText = worldNodeDevelopmentCompleteText(due, content.name);
  notifySuccess(completeText);
  desktopNotify({
    category: 'Progress',
    title: t('worldNodeDevelopmentTick.developmentFinished'),
    body: completeText,
  });

  if (content.__type === 'shrine') {
    void taskEventShrineLevel(nodeName, level);
  }

  analyticsSendDesignEvent(
    `World:${WORLD_NODE_TYPE_BY_CONTENT_TYPE[content.__type]}:LevelUpComplete:${analyticsSafeSegment(nodeName)}`,
  );
}

export function worldNodeDevelopmentProcessTick(): void {
  const due = worldNodeDevelopmentsDue(timerTicksElapsed());
  if (due.length === 0) return;

  updateGamestate((state) => {
    due.forEach(({ nodeName, content, level }) => {
      state[WORLD_NODE_DEVELOPMENT_SLICES[content.__type]][nodeName] = {
        level,
      };
    });
    if (due.some(({ content }) => content.__type === 'outpost'))
      applyOutpostBuffRefresh(state, state.world.currentLocation.mapName);
    return state;
  });

  due.forEach(worldNodeDevelopmentAnnounce);
}
