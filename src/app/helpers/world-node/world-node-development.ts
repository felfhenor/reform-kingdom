import type {
  CostItem,
  GameStateWorldNodeLevel,
  GameStateWorldNodeLevels,
  WorldNodeDevelopable,
} from '@interfaces';

export function worldNodeDevelopmentMaxLevel(
  content: WorldNodeDevelopable,
): number {
  return content.levels.length;
}

export function worldNodeDevelopmentIsMaxLevel(
  content: WorldNodeDevelopable,
  level: number,
): boolean {
  return level >= worldNodeDevelopmentMaxLevel(content);
}

export function worldNodeDevelopmentLevelUpCost(
  content: WorldNodeDevelopable,
  level: number,
): CostItem[] {
  return content.levels[level]?.costs ?? [];
}

export function worldNodeDevelopmentTime(
  content: WorldNodeDevelopable,
  level: number,
): number {
  return content.levels[level]?.developTime ?? 0;
}

// A pending development is dropped once there's no level left for it to reach.
function pruneWorldNodeDevelopmentLevel(
  entry: GameStateWorldNodeLevel,
  content: WorldNodeDevelopable,
): GameStateWorldNodeLevel {
  const level = Math.min(entry.level, worldNodeDevelopmentMaxLevel(content));
  const { developCompletesAtTick } = entry;
  return developCompletesAtTick !== undefined &&
    !worldNodeDevelopmentIsMaxLevel(content, level)
    ? { level, developCompletesAtTick }
    : { level };
}

// Drops entries whose node no longer resolves, and clamps to the current max achievable level.
export function pruneInvalidWorldNodeDevelopmentLevels(
  levels: GameStateWorldNodeLevels,
  contentForNode: (nodeName: string) => WorldNodeDevelopable | undefined,
): GameStateWorldNodeLevels {
  const pruned: GameStateWorldNodeLevels = {};

  Object.keys(levels).forEach((nodeName) => {
    const content = contentForNode(nodeName);
    if (!content) return;

    pruned[nodeName] = pruneWorldNodeDevelopmentLevel(
      levels[nodeName],
      content,
    );
  });

  return pruned;
}
