import { updateGamestate } from '@helpers/state-game';
import { isTaskRequirementCounter } from '@helpers/task/task';
import { tasksCompletedEmit } from '@helpers/task/task-completed';
import { tasksIncomplete } from '@helpers/task/task-incomplete';
import type { GameState, TaskContent, TaskRequirement } from '@interfaces';

// Mutates `state` directly - call only from inside an `updateGamestate` callback.
function tasksApplyRecord(
  state: GameState,
  candidates: TaskContent[],
  amount: number,
): TaskContent[] {
  return candidates.filter((task) => {
    const entry = (state.tasks[task.id] ??= { progress: 0 });
    if (entry.completedAt) return false;

    if (isTaskRequirementCounter(task.requirement)) {
      const target = task.requirement.quantity;
      entry.progress = Math.min(entry.progress + amount, target);
      if (entry.progress < target) return false;
    }

    entry.completedAt = Date.now();
    return true;
  });
}

// `matches` must only accept an event that proves the requirement: non-counter tasks latch outright.
export function tasksRecord(
  matches: (requirement: TaskRequirement) => boolean,
  amount = 1,
): Promise<void> {
  if (amount <= 0) return Promise.resolve();

  const candidates = tasksIncomplete().filter((task) =>
    matches(task.requirement),
  );
  if (candidates.length === 0) return Promise.resolve();

  const completed: TaskContent[] = [];
  let wroteImmediately = false as boolean;
  const write = updateGamestate((state) => {
    wroteImmediately = true;
    completed.push(...tasksApplyRecord(state, candidates, amount));
    return state;
  });

  // In a tick the write is synchronous, so announcing now keeps log order; from a UI action it's deferred until the write lands.
  if (wroteImmediately) {
    tasksCompletedEmit(completed);
    return write;
  }
  return write.then(() => tasksCompletedEmit(completed));
}
