import { t } from '@helpers/i18n/i18n';
import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { desktopNotify } from '@helpers/engine/desktop-notify';
import { modalOpen } from '@helpers/engine/modal-stack';
import { notifySuccess } from '@helpers/engine/notify';
import { founderWhisperLog } from '@helpers/lore/founder-whisper';
import type { TaskContent } from '@interfaces';

export function tasksAnnounceCompleted(tasks: TaskContent[]): void {
  tasks.forEach((task) => {
    notifySuccess(t('taskComplete.taskComplete', { name: task.name }), () =>
      modalOpen('tasks'),
    );
    desktopNotify({
      category: 'Progress',
      title: 'Task Complete',
      body: task.name,
    });
    miscellaneousMessageLog(
      t('taskComplete.taskComplete2', { name: task.name }),
    );
    if (task.whisper) {
      founderWhisperLog(task.whisper);
    }
    analyticsSendDesignEvent('Task:Complete');
    analyticsSendDesignEvent(
      `Task:Complete:${analyticsSafeSegment(task.name)}`,
    );
  });
}
