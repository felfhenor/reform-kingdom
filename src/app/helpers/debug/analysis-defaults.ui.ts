// Content-derived defaults for inputs whose sensible starting value depends on the content, keyed by input key.

import { getEntriesByType } from '@helpers/content/content';
import { buildMonsterLevels } from '@helpers/debug/analysis-item-sources';
import { highestTradeskillMinLevel } from '@helpers/debug/analysis-tradeskillgaps';
import type {
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  LevelRange,
  RecipeContent,
} from '@interfaces';

// The higher of the top monster level (unioned across every encounter/random encounter it's assigned to) and the top node level.
export function computeDefaultLevel(): number {
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms =
    getEntriesByType<EncounterRandomContent>('encounterrandom');
  const gatherings = getEntriesByType<GatheringContent>('gathering');

  const monsterLevels = buildMonsterLevels(encounters, encounterRandoms);
  const maxMonsterLevel = Math.max(
    0,
    ...[...monsterLevels.values()].map((range) => range.max),
  );

  const nodeRanges: LevelRange[] = [
    ...encounters,
    ...encounterRandoms,
    ...gatherings,
  ]
    .map((n) => n.levelRange)
    .filter(Boolean);
  const maxNodeLevel = Math.max(0, ...nodeRanges.map((r) => r.max));

  return Math.max(maxMonsterLevel, maxNodeLevel, 1);
}

export function computeDefaultTradeskillLevel(): number {
  return highestTradeskillMinLevel(getEntriesByType<RecipeContent>('recipe'));
}

export const CONTENT_DERIVED_DEFAULTS: Record<string, () => number> = {
  level: computeDefaultLevel,
  tradeskillLevel: computeDefaultTradeskillLevel,
};
