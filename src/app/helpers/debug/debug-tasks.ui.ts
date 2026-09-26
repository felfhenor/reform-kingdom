import { updateGamestate } from '@helpers/state-game';
import { tasksOrdered } from '@helpers/task/task';
import { retrofitTasks } from '@helpers/task/task-migrate';

// Counters restart at 0 while state-based tasks that still hold re-latch now, the same way a load would.
export function debugResetTasks(): void {
  updateGamestate((state) => {
    const reset = Object.fromEntries(
      tasksOrdered().map((task) => [task.id, { progress: 0 }]),
    );
    state.tasks = retrofitTasks({ ...state, tasks: reset });
    return state;
  });
}
