import { allContentById, getEntry } from '@helpers/content/content';
import { sourceTargetKey } from '@helpers/item/content-sources';
import { regionContentSources } from '@helpers/item/region-sources';
import { globalEffectSumsState } from '@helpers/state-game';
import { isTaskImpossibleThisRun } from '@helpers/task/task';
import {
  isWorldNodeNameRemoved,
  worldNodeByName,
  worldNodeGathering,
  worldNodeLookup,
  worldNodeShrine,
} from '@helpers/world-node/world-nodes';
import type {
  CollectibleSource,
  ObtainableContext,
  ObtainableRunCache,
  SourceTarget,
  TaskContent,
  WorldNodeDevelopableContent,
} from '@interfaces';

function contextNew(includeTasks: boolean): ObtainableContext {
  return { includeTasks, memo: new Map(), visiting: new Set(), cycleCuts: 0 };
}

// Shared until content, maps or this run's effect sums change; per-tick achievement checks stay cheap.
let runCache: ObtainableRunCache | undefined;

function runCacheGet(): ObtainableRunCache {
  const content = allContentById();
  const lookup = worldNodeLookup();
  const sums = globalEffectSumsState();
  if (
    runCache?.content !== content ||
    runCache.lookup !== lookup ||
    runCache.sums !== sums
  ) {
    runCache = {
      content,
      lookup,
      sums,
      withTasks: contextNew(true),
      withoutTasks: contextNew(false),
      developmentCaps: new Map(),
    };
  }
  return runCache;
}

function sourceAvailable(
  source: CollectibleSource,
  context: ObtainableContext,
): boolean {
  const sums = globalEffectSumsState();
  switch (source.type) {
    case 'node':
      return (
        !isWorldNodeNameRemoved(source.name) &&
        (source.requires ?? []).every(
          (required) => !targetUnobtainable(required, context),
        )
      );
    case 'crafting':
      return !sums.tradeskillsDisabled;
    case 'townCraft':
      return !source.isEquipment || !sums.townShopNoEquipment;
    case 'task':
      return context.includeTasks && !isTaskUnavailableById(source.taskId);
    default:
      return true;
  }
}

// A cut cycle counts as unobtainable and isn't memoized, so nothing unreachable is ever counted.
function targetUnobtainable(
  target: SourceTarget,
  context: ObtainableContext,
): boolean {
  const key = sourceTargetKey(target);
  const memo = context.memo.get(key);
  if (memo !== undefined) return memo;
  if (context.visiting.has(key)) {
    context.cycleCuts += 1;
    return true;
  }

  const cutsBefore = context.cycleCuts;
  context.visiting.add(key);
  const sources = regionContentSources(target);
  const unobtainable =
    sources.length > 0 &&
    !sources.some((source) => sourceAvailable(source, context));
  context.visiting.delete(key);

  if (context.cycleCuts === cutsBefore) context.memo.set(key, unobtainable);
  return unobtainable;
}

// Has sources, and none of them can produce it under this run's edicts.
export function isUnobtainableThisRun(target: SourceTarget): boolean {
  return targetUnobtainable(target, runCacheGet().withTasks);
}

export function isSourceAvailableThisRun(source: CollectibleSource): boolean {
  return sourceAvailable(source, runCacheGet().withTasks);
}

// Levels up to the first one with a cost this run can't supply; task rewards don't count, as tasks depend on these caps.
export function worldNodeDevelopmentObtainableMaxLevel(
  content: WorldNodeDevelopableContent,
): number {
  const cache = runCacheGet();
  const cached = cache.developmentCaps.get(content.id);
  if (cached !== undefined) return cached;

  const blocked = content.levels.findIndex((level) =>
    level.costs.some(({ itemId }) =>
      targetUnobtainable({ itemId }, cache.withoutTasks),
    ),
  );
  const cap = blocked === -1 ? content.levels.length : blocked;
  cache.developmentCaps.set(content.id, cap);
  return cap;
}

function isTaskPastDevelopmentCap(task: TaskContent): boolean {
  const requirement = task.requirement;
  if (requirement.kind !== 'ShrineLevel' && requirement.kind !== 'GatherItem') {
    return false;
  }

  const entry = worldNodeByName(requirement.nodeName);
  if (!entry) return false;
  if (requirement.kind === 'ShrineLevel') {
    const shrine = worldNodeShrine(entry);
    return (
      !!shrine &&
      worldNodeDevelopmentObtainableMaxLevel(shrine) < requirement.level
    );
  }

  const gathering = worldNodeGathering(entry);
  if (!gathering) return false;
  const cap = worldNodeDevelopmentObtainableMaxLevel(gathering);
  const results = gathering.gatherResults.filter((result) =>
    result.items.some((item) => item.itemId === requirement.itemId),
  );
  return (
    results.length > 0 &&
    results.every((result) => (result.levelRequirement ?? 0) > cap)
  );
}

export function isTaskUnavailableThisRun(task: TaskContent): boolean {
  return isTaskImpossibleThisRun(task) || isTaskPastDevelopmentCap(task);
}

function isTaskUnavailableById(taskId: TaskContent['id']): boolean {
  const task = getEntry<TaskContent>(taskId);
  return !task || isTaskUnavailableThisRun(task);
}
