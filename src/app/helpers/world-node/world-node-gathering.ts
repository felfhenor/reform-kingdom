import {
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  GatherResult,
  GatheringContent,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';

export function worldNodeGatherTime(entry: WorldNodeEntry): number | undefined {
  return worldNodeGathering(entry)?.gatherTime;
}

// Keyed by (content, level) - level only ever increases (gatherNodeLevelUp), so a level-up is just a miss, never stale.
const resultsAtLevelCache = new WeakMap<GatheringContent, Map<number, GatherResult[]>>();

// No levelRequirement = always available; otherwise must match the level exactly.
export function gatheringResultsAtLevel(
  gathering: GatheringContent,
  level: number,
): GatherResult[] {
  const byLevel = resultsAtLevelCache.get(gathering) ?? new Map<number, GatherResult[]>();
  const cached = byLevel.get(level);
  if (cached) return cached;

  const results = gathering.gatherResults.filter(
    (result) =>
      result.levelRequirement === undefined || result.levelRequirement === level,
  );

  byLevel.set(level, results);
  resultsAtLevelCache.set(gathering, byLevel);
  return results;
}

// Ignores discovery/level (unlike `worldNodeGatherMaterialIds`) - lets `pruneInvalidDecreeGatherClauses` tell "not unlocked yet" apart from "no longer exists".
export function allGatherableMaterialIds(): MaterialId[] {
  const ids = new Set<MaterialId>();

  worldNodesOfType('GatherNode').forEach((entry) => {
    const gathering = worldNodeGathering(entry);
    if (!gathering) return;

    gathering.gatherResults.forEach((result) => {
      result.items.forEach((item) => ids.add(item.itemId as MaterialId));
    });
  });

  return [...ids];
}
