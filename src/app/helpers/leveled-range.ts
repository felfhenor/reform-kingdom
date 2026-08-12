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

// Formats a resolved range for display - a single number when min and max
// are equal, otherwise a "min-max" span.
export function rangeLabel(range: DropRange): string {
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
}

// `rangeAtLevel` + `rangeLabel` in one step, for anything that both scales
// by level and displays the result (e.g. bestiary XP/drop previews).
export function rangeLabelAtLevel(range: LeveledRange, level: number): string {
  return rangeLabel(rangeAtLevel(range, level));
}
