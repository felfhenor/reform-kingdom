import { getEntriesByType } from '@helpers/content/content';
import { exchangeEdictRewardCollectibleIds } from '@helpers/exchange/exchange';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import {
  bestiaryMonsters,
  isMonsterDiscovered,
} from '@helpers/kingdom/bestiary';
import { isFoundOnlyAtRemovedNodes } from '@helpers/kingdom/museum';
import { globalEffectSumsState, tasksState } from '@helpers/state-game';
import { isTaskOnRemovedNode } from '@helpers/task/task';
import { isWorkerRescued } from '@helpers/worker/worker-discovery';
import { worldNodeDevelopmentMaxLevel } from '@helpers/world-node/world-node-development';
import {
  WORLD_NODE_DEVELOPABLE_TYPES,
  WORLD_NODE_DEVELOPMENT_SELECTORS,
} from '@helpers/world-node/world-node-development-state';
import { isWorldNodeTypeRemoved } from '@helpers/world-node/world-nodes';
import type {
  CollectibleContent,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  RemembranceCategory,
  SourceTarget,
  TaskContent,
  TownContent,
  WorkerContent,
  WorldNodeDevelopableContent,
  WorldNodeDevelopableType,
} from '@interfaces';
import { WORLD_NODE_TYPE_BY_CONTENT_TYPE } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

const REMEMBRANCE_DEVELOPMENT_NAMES: Record<WorldNodeDevelopableType, string> =
  {
    shrine: 'Shrine Development',
    outpost: 'Outpost Development',
    gathering: 'Gather Location Development',
  };

// Source lookups scan all content, so they're skipped in the usual run with nothing removed.
function findable<T extends { id: string; unobtainable?: boolean }>(
  entries: T[],
  target: (id: string) => SourceTarget,
): T[] {
  const anyRemoved =
    Object.keys(globalEffectSumsState().removedWorldNodeTypes).length > 0;
  return obtainable(entries).filter(
    (entry) => !anyRemoved || !isFoundOnlyAtRemovedNodes(target(entry.id)),
  );
}

function remembranceCount<T>(
  name: string,
  entries: T[],
  isDone: (entry: T) => boolean,
): RemembranceCategory {
  return { name, current: entries.filter(isDone).length, max: entries.length };
}

function obtainable<T extends { unobtainable?: boolean }>(entries: T[]): T[] {
  return entries.filter((entry) => !entry.unobtainable);
}

export function remembranceCollectibles(): RemembranceCategory {
  const edictRewards = exchangeEdictRewardCollectibleIds();
  return remembranceCount(
    'Collectibles',
    obtainable(getEntriesByType<CollectibleContent>('collectible')).filter(
      (collectible) => !edictRewards.has(collectible.id),
    ),
    (collectible) => isCollectibleDiscovered(collectible.id),
  );
}

export function remembranceMaterials(): RemembranceCategory {
  return remembranceCount(
    'Materials',
    findable(getEntriesByType<ItemContent>('item'), (id) => ({
      itemId: id as ItemId,
    })),
    (item) => isMaterialDiscovered(item.id),
  );
}

export function remembranceEquipment(): RemembranceCategory {
  return remembranceCount(
    'Equipment',
    findable(getEntriesByType<EquipmentContent>('equipment'), (id) => ({
      equipmentId: id as EquipmentId,
    })),
    (equipment) => isEquipmentDiscovered(equipment.id),
  );
}

export function remembranceBestiary(): RemembranceCategory {
  return remembranceCount('Bestiary', bestiaryMonsters(), (monster) =>
    isMonsterDiscovered(monster.id),
  );
}

// Town rosters reuse the worker pool, but those workers can never be rescued.
export function remembranceWorkers(): RemembranceCategory {
  const townWorkerIds = new Set(
    getEntriesByType<TownContent>('town').flatMap((town) =>
      town.gathering.workers.map((worker) => worker.workerId),
    ),
  );
  const rescuable = getEntriesByType<WorkerContent>('worker').filter(
    (worker) => !townWorkerIds.has(worker.id),
  );

  return remembranceCount('Workers Rescued', rescuable, (worker) =>
    isWorkerRescued(worker.id),
  );
}

export function remembranceDevelopment(
  type: WorldNodeDevelopableType,
): RemembranceCategory {
  const levels = WORLD_NODE_DEVELOPMENT_SELECTORS[type]() ?? {};
  const contents = getEntriesByType<WorldNodeDevelopableContent>(type);

  return {
    name: REMEMBRANCE_DEVELOPMENT_NAMES[type],
    current: sumBy(contents, (content) =>
      Math.min(
        levels[content.name]?.level ?? 0,
        worldNodeDevelopmentMaxLevel(content),
      ),
    ),
    max: sumBy(contents, worldNodeDevelopmentMaxLevel),
  };
}

export function remembranceTasks(): RemembranceCategory {
  const tasks = tasksState();
  return remembranceCount(
    'Tasks',
    getEntriesByType<TaskContent>('task').filter(
      (task) => !isTaskOnRemovedNode(task),
    ),
    (task) => !!tasks[task.id]?.completedAt,
  );
}

export function remembranceCategories(): RemembranceCategory[] {
  return [
    remembranceCollectibles(),
    remembranceMaterials(),
    remembranceEquipment(),
    remembranceBestiary(),
    remembranceWorkers(),
    ...WORLD_NODE_DEVELOPABLE_TYPES.filter(
      (type) => !isWorldNodeTypeRemoved(WORLD_NODE_TYPE_BY_CONTENT_TYPE[type]),
    ).map(remembranceDevelopment),
    remembranceTasks(),
  ];
}
