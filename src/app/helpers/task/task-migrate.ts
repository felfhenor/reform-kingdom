import { getEntry } from '@helpers/content/content';
import { isTaskRequirementCounter, tasksOrdered } from '@helpers/task/task';
import { taskRequirementSatisfiedOnLoad } from '@helpers/task/task-requirement';
import { taskStateRequirementSatisfied } from '@helpers/task/task-requirement-state';
import type {
  GameState,
  GameStateTasks,
  TaskContent,
  TaskId,
} from '@interfaces';

export function pruneInvalidTasks(tasks: GameStateTasks): GameStateTasks {
  const pruned: GameStateTasks = {};

  (Object.keys(tasks) as TaskId[]).forEach((taskId) => {
    if (getEntry<TaskContent>(taskId)) {
      pruned[taskId] = tasks[taskId];
    }
  });

  return pruned;
}

function taskLatchesOnLoad(state: GameState, task: TaskContent): boolean {
  const entry = state.tasks[task.id];
  if (!entry) return taskRequirementSatisfiedOnLoad(state, task.requirement);
  if (entry.completedAt || isTaskRequirementCounter(task.requirement)) {
    return false;
  }
  return taskStateRequirementSatisfied(state, task.requirement);
}

// Only events latch state-based tasks in play, so they're re-checked here on every load; latches are silent and stay claimable.
export function retrofitTasks(state: GameState): GameStateTasks {
  const tasks: GameStateTasks = { ...state.tasks };
  const now = Date.now();

  tasksOrdered().forEach((task) => {
    const entry = tasks[task.id] ?? { progress: 0 };
    tasks[task.id] = taskLatchesOnLoad(state, task)
      ? { ...entry, completedAt: now }
      : entry;
  });

  return tasks;
}
