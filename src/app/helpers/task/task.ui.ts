import { TASK_WIDGET_ENTRY_COUNT } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { bestiaryState, tasksState } from '@helpers/state-game';
import { isTaskRequirementCounter, tasksOrdered } from '@helpers/task/task';
import type {
  GameStateTasks,
  ItemContent,
  TaskContent,
  TaskId,
  TaskRowViewModel,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function taskProgress(
  task: TaskContent,
  tasks: GameStateTasks,
): TaskRowViewModel['progress'] {
  const { requirement } = task;
  if (isTaskRequirementCounter(requirement)) {
    return {
      current: tasks[task.id]?.progress ?? 0,
      target: requirement.quantity,
    };
  }
  if (requirement.kind !== 'DefeatMonster') return undefined;

  const kills = bestiaryState()[requirement.monsterId]?.kills ?? 0;
  return {
    current: Math.min(kills, requirement.quantity),
    target: requirement.quantity,
  };
}

function taskRowViewModel(
  task: TaskContent,
  tasks: GameStateTasks,
): TaskRowViewModel {
  const entry = tasks[task.id];
  const isComplete = !!entry?.completedAt;

  return {
    taskId: task.id,
    name: task.name,
    description: task.description,
    isComplete,
    isClaimed: !!entry?.claimedAt,
    progress: isComplete ? undefined : taskProgress(task, tasks),
    rewards: task.rewards.map((reward) => ({
      ...reward,
      name: getEntry<ItemContent>(reward.itemId)?.name ?? '',
    })),
  };
}

function taskRowViewModelsByOrder(): TaskRowViewModel[] {
  const tasks = tasksState();
  return tasksOrdered().map((task) => taskRowViewModel(task, tasks));
}

// Unclaimed first so rewards waiting to be claimed stay near the top.
export function taskRowViewModels(): TaskRowViewModel[] {
  return sortBy(taskRowViewModelsByOrder(), (row) => (row.isClaimed ? 1 : 0));
}

export function tasksWidgetEntries(): TaskRowViewModel[] {
  return taskRowViewModelsByOrder()
    .filter((row) => !row.isClaimed)
    .slice(0, TASK_WIDGET_ENTRY_COUNT);
}

export function tasksClaimableIds(): TaskId[] {
  const tasks = tasksState();
  return tasksOrdered()
    .filter((task) => tasks[task.id]?.completedAt && !tasks[task.id]?.claimedAt)
    .map((task) => task.id);
}
