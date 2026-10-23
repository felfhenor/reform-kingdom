import { getEntriesByType, getEntry } from '@helpers/content/content';
import type {
  TaskContent,
  TaskRequirement,
  TaskRequirementCounter,
  TownContent,
  TrainerContent,
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

// The world node a requirement is fulfilled at, if it's tied to one.
export function taskRequirementNodeName(
  requirement: TaskRequirement,
): string | undefined {
  switch (requirement.kind) {
    case 'GatherItem':
    case 'ClearEncounter':
    case 'ShrineLevel':
      return requirement.nodeName;
    case 'LearnTeaching':
      return getEntry<TrainerContent>(requirement.trainerId)?.name;
    case 'VisitTown':
    case 'TownReputationTier':
      return getEntry<TownContent>(requirement.townId)?.name;
    default:
      return undefined;
  }
}
