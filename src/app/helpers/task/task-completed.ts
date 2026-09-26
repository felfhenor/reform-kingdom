import type { TaskContent } from '@interfaces';
import { Subject } from 'rxjs';

const tasksCompleted = new Subject<TaskContent[]>();
export const tasksCompleted$ = tasksCompleted.asObservable();

// The toast/log/analytics subscriber lives in the UI layer, keeping the task system free of side-effect imports so CLI analysis can load it.
export function tasksCompletedEmit(tasks: TaskContent[]): void {
  if (tasks.length === 0) return;
  tasksCompleted.next(tasks);
}
