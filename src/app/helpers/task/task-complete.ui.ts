import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import type { TaskContent } from '@interfaces';

export function tasksAnnounceCompleted(tasks: TaskContent[]): void {
  tasks.forEach((task) => {
    notifySuccess(`Task complete: ${task.name}`);
    miscellaneousMessageLog(`Task complete: **${task.name}**`);
    analyticsSendDesignEvent('Task:Complete');
    analyticsSendDesignEvent(
      `Task:Complete:${analyticsSafeSegment(task.name)}`,
    );
  });
}
