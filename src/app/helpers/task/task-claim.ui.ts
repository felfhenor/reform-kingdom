import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { notifySuccess } from '@helpers/engine/notify';
import { applyMaterialDelta } from '@helpers/item/materials';
import { updateGamestate } from '@helpers/state-game';
import type { TaskContent, TaskId } from '@interfaces';

function tasksAnnounceClaimed(claimed: TaskContent[]): void {
  if (claimed.length === 0) return;

  notifySuccess(
    claimed.length === 1
      ? `Claimed the reward for ${claimed[0].name}!`
      : `Claimed the rewards for ${claimed.length} tasks!`,
  );

  claimed.forEach((task) => {
    analyticsSendDesignEvent('Task:Claim');
    analyticsSendDesignEvent(`Task:Claim:${analyticsSafeSegment(task.name)}`);
  });
}

export async function tasksClaim(taskIds: TaskId[]): Promise<void> {
  const claimed: TaskContent[] = [];

  await updateGamestate((state) => {
    taskIds.forEach((taskId) => {
      const entry = state.tasks[taskId];
      const task = getEntry<TaskContent>(taskId);
      if (!task || !entry?.completedAt || entry.claimedAt) return;

      task.rewards.forEach((reward) =>
        applyMaterialDelta(state, reward.itemId, reward.quantity),
      );
      entry.claimedAt = Date.now();
      claimed.push(task);
    });
    return state;
  });

  tasksAnnounceClaimed(claimed);
}
