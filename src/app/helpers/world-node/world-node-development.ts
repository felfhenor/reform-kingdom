import type {
  CostItem,
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

// Drops entries whose node no longer resolves, and clamps to the current max achievable level.
export function pruneInvalidWorldNodeDevelopmentLevels(
  levels: GameStateWorldNodeLevels,
  contentForNode: (nodeName: string) => WorldNodeDevelopable | undefined,
): GameStateWorldNodeLevels {
  const pruned: GameStateWorldNodeLevels = {};

  Object.keys(levels).forEach((nodeName) => {
    const content = contentForNode(nodeName);
    if (!content) return;

    pruned[nodeName] = {
      level: Math.min(
        levels[nodeName].level,
        worldNodeDevelopmentMaxLevel(content),
      ),
    };
  });

  return pruned;
}
