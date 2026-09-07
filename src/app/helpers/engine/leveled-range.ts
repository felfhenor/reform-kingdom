import type { DropRange, LeveledRange } from '@interfaces';

export function rangeAtLevel(range: LeveledRange, level: number): DropRange {
  const bonus = (range.bonusPerLevel ?? 0) * level;

  return {
    min: range.min + bonus,
    max: range.max + bonus,
  };
}

export function rangeLabel(range: DropRange): string {
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
}

export function rangeLabelAtLevel(range: LeveledRange, level: number): string {
  return rangeLabel(rangeAtLevel(range, level));
}
