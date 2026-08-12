import type { DropRange, LeveledRange } from '@interfaces';

// Resolves a `LeveledRange` down to its concrete min/max at a given level -
// `bonusPerLevel` (when present) is added flat to both ends, scaled by the
// level itself. Shared by anything that rolls or previews a level-scaled
// range: monster XP rewards (`monsterXpReward`), item drop quantities
// (`rollDroppedRewards`), and their bestiary preview labels.
export function rangeAtLevel(range: LeveledRange, level: number): DropRange {
  const bonus = (range.bonusPerLevel ?? 0) * level;

  return {
    min: range.min + bonus,
    max: range.max + bonus,
  };
}
