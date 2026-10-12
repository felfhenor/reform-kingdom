import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { updateGamestate } from '@helpers/state-game';
import { taskEventShrineLevel } from '@helpers/task/task-events';
import {
  WORLD_NODE_DEVELOPMENT_ANALYTICS_SEGMENTS,
  WORLD_NODE_DEVELOPMENT_SLICES,
  worldNodeDevelopmentsDue,
} from '@helpers/world-node/world-node-development-state';
import type { WorldNodeDevelopmentDue } from '@interfaces';

function worldNodeDevelopmentCompleteText(
  { content, level }: WorldNodeDevelopmentDue,
  name: string,
): string {
  return content.__type === 'outpost' && level === 1
    ? `${name} has been built.`
    : `${name} has been developed to +${level}.`;
}

function worldNodeDevelopmentAnnounce(due: WorldNodeDevelopmentDue): void {
  const { nodeName, content, level } = due;
  miscellaneousMessageLog(
    worldNodeDevelopmentCompleteText(due, `**${content.name}**`),
  );
  notifySuccess(worldNodeDevelopmentCompleteText(due, content.name));

  if (content.__type === 'shrine') {
    void taskEventShrineLevel(nodeName, level);
  }

  analyticsSendDesignEvent(
    `World:${WORLD_NODE_DEVELOPMENT_ANALYTICS_SEGMENTS[content.__type]}:LevelUpComplete:${analyticsSafeSegment(nodeName)}`,
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
    return state;
  });

  due.forEach(worldNodeDevelopmentAnnounce);
}
