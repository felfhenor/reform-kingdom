import type { ExploreNodeRiskBand, LevelRange } from '@interfaces';

// Beyond this many levels above the party's floor, a range is excluded outright (TooHigh) regardless of risk setting.
export const HIGH_RISK_LEVELS_ABOVE_PARTY = 7;

// Judged against both ends of the range, since a roll can land anywhere in it, not just the floor.
export function riskBandForLevelRange(
  range: LevelRange,
  partyLevel: number,
): ExploreNodeRiskBand {
  if (range.max <= partyLevel) return 'Low';
  if (range.min <= partyLevel) return 'Medium';

  const levelsAboveParty = range.min - partyLevel;
  if (levelsAboveParty <= HIGH_RISK_LEVELS_ABOVE_PARTY) return 'High';

  return 'TooHigh';
}
