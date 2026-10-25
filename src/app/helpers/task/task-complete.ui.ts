import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import { founderWhisperLog } from '@helpers/lore/founder-whisper';
import type { TaskContent } from '@interfaces';

export function tasksAnnounceCompleted(tasks: TaskContent[]): void {
  tasks.forEach((task) => {
    notifySuccess(`Task complete: ${task.name}`);
    miscellaneousMessageLog(`Task complete: **${task.name}**`);
    if (task.whisper) {
      founderWhisperLog(task.whisper);
    }
    analyticsSendDesignEvent('Task:Complete');
    analyticsSendDesignEvent(
      `Task:Complete:${analyticsSafeSegment(task.name)}`,
    );
  });
}
