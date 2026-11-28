import { contentName } from '@helpers/i18n/i18n-content';
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
    notifySuccess(
      t('taskComplete.taskComplete', { name: contentName(task) }),
      () => modalOpen('tasks'),
    );
    desktopNotify({
      category: 'Progress',
      title: t('taskComplete.taskComplete3'),
      body: contentName(task),
    });
    miscellaneousMessageLog(
      t('taskComplete.taskComplete2', { name: contentName(task) }),
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
