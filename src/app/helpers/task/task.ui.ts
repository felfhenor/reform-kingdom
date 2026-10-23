import { TASK_WIDGET_ENTRY_COUNT } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { modalClose } from '@helpers/engine/modal-stack';
import { setGamePlayView, worldCameraFocus } from '@helpers/engine/ui';
import { regionForMap } from '@helpers/lore/region-intro';
import {
  bestiaryState,
  tasksState,
  worldCurrentLocationState,
} from '@helpers/state-game';
import {
  isTaskRequirementCounter,
  taskRequirementNodeName,
  tasksOrdered,
} from '@helpers/task/task';
import { isWorldMapVisited } from '@helpers/world-node/world-map-discovery';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  GameStateTasks,
  ItemContent,
  TaskContent,
  TaskId,
  TaskRowViewModel,
  WorldNodeEntry,
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

function taskLocate(task: TaskContent): TaskRowViewModel['locate'] {
  const nodeName = taskRequirementNodeName(task.requirement);
  const node = nodeName ? worldNodeByName(nodeName) : undefined;
  if (!node) return undefined;

  const mapName = regionForMap(node.mapName)?.name ?? node.mapName;
  const disabledReason =
    node.mapName === worldCurrentLocationState().mapName
      ? ''
      : `You must be in ${mapName} to locate this node.`;
  return { node, disabledReason };
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
    locate: isComplete ? undefined : taskLocate(task),
    rewards: task.rewards.map((reward) => ({
      ...reward,
      name: getEntry<ItemContent>(reward.itemId)?.name ?? '',
    })),
  };
}

// Completed tasks stay listed so a reward earned off-map can still be claimed.
function isTaskVisible(task: TaskContent, tasks: GameStateTasks): boolean {
  return (
    !task.requireMapVisit ||
    !!tasks[task.id]?.completedAt ||
    isWorldMapVisited(task.requireMapVisit)
  );
}

function taskRowViewModelsByOrder(): TaskRowViewModel[] {
  const tasks = tasksState();
  return tasksOrdered()
    .filter((task) => isTaskVisible(task, tasks))
    .map((task) => taskRowViewModel(task, tasks));
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
    .filter(
      (task) => !!tasks[task.id]?.completedAt && !tasks[task.id]?.claimedAt,
    )
    .map((task) => task.id);
}

export function taskNodeLocate(node: WorldNodeEntry): void {
  modalClose('tasks');
  setGamePlayView('world');
  worldCameraFocus(node);
}
