import { isXpTrivialAtOverLevel } from '@helpers/combat/monster';
import { riskBandForLevelRange } from '@helpers/engine/risk-band';
import type {
  DifficultyTier,
  ExploreNodeRiskBand,
  LevelRange,
} from '@interfaces';

export const RISK_BAND_DIFFICULTY: Record<ExploreNodeRiskBand, DifficultyTier> =
  {
    Low: 'Easy',
    Medium: 'Medium',
    High: 'Hard',
    TooHigh: 'TooHigh',
  };

export function exploreDifficultyTier(
  range: LevelRange,
  level: number,
): DifficultyTier {
  if (isXpTrivialAtOverLevel(level, range.max)) return 'Trivial';
  return RISK_BAND_DIFFICULTY[riskBandForLevelRange(range, level)];
}

// Gathering is gated at the floor and gives no XP past the ceiling, so both edges are hard cutoffs.
export function gatherDifficultyTier(
  range: LevelRange,
  level: number,
): DifficultyTier {
  if (level < range.min) return 'TooHigh';
  if (level > range.max) return 'Trivial';
  return RISK_BAND_DIFFICULTY[riskBandForLevelRange(range, level)];
}
