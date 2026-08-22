/**
 * Computes a content-derived default for the shared `level` input, instead
 * of a hardcoded guess - the higher of the top monster level (unioned across
 * every encounter/random encounter it's assigned to) and the top node level
 * (the same "item obtainable level" proxy `analysis-contentgaps.ts` uses),
 * so Hero Stats/Monster Stats default to showing the current top of authored
 * content rather than an arbitrary number.
 */

import { getEntriesByType } from '@helpers/content';
import { buildMonsterLevels } from '@helpers/debug/analysis-item-sources';
import type {
  EncounterContent,
  EncounterRandomContent,
  GatheringContent,
  LevelRange,
} from '@interfaces';

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
