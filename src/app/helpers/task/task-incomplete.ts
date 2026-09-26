import { computed } from '@angular/core';
import { tasksState } from '@helpers/state-game';
import { tasksOrdered } from '@helpers/task/task';

// Memoized over the tasks slice so frequent event hooks don't rescan content each time.
export const tasksIncomplete = computed(() => {
  const tasks = tasksState();
  return tasksOrdered().filter((task) => !tasks[task.id]?.completedAt);
});
