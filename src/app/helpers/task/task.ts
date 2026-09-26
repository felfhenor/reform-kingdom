import { getEntriesByType } from '@helpers/content/content';
import type {
  TaskContent,
  TaskRequirement,
  TaskRequirementCounter,
} from '@interfaces';
import { TaskRequirementCounterKinds } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export function tasksOrdered(): TaskContent[] {
  return sortBy(getEntriesByType<TaskContent>('task'), (task) => task.order);
}

export function isTaskRequirementCounter(
  requirement: TaskRequirement,
): requirement is TaskRequirementCounter {
  return TaskRequirementCounterKinds.includes(
    requirement.kind as TaskRequirementCounter['kind'],
  );
}
