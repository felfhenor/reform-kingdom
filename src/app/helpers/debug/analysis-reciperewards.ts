/**
 * Validates that every `recipeId` completion reward across every encounter
 * (and random encounter) resolves to a real compiled recipe. Ported from
 * `scripts/validate-reciperewards.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  RecipeContent,
} from '@interfaces';

export function runRecipeRewardsAnalysis(): AnalysisRunResult {
  const recipeIds = new Set(getEntriesByType<RecipeContent>('recipe').map((r) => r.id));
  const encounters = getEntriesByType<EncounterContent>('encounter');
  const encounterRandoms = getEntriesByType<EncounterRandomContent>('encounterrandom');

  const checks: AnalysisCheck[] = [];

  [...encounters, ...encounterRandoms].forEach((encounter) => {
    encounter.completionRewards.forEach((reward) => {
      if (!('recipeId' in reward)) return;

      const id = `${encounter.id}:${reward.recipeId}`;
      if (!recipeIds.has(reward.recipeId)) {
        checks.push({
          id,
          label: encounter.name,
          status: 'fail',
          message: `Encounter "${encounter.name}" has a completion reward referencing recipeId "${reward.recipeId}", which doesn't resolve to any compiled recipe.`,
        });
        return;
      }

      checks.push({
        id,
        label: encounter.name,
        status: 'pass',
        message: `"${encounter.name}" -> recipeId "${reward.recipeId}" resolves.`,
      });
    });
  });

  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every recipeId completion reward resolves to a real recipe.'
        : `${failures} recipe reward(s) don't resolve.`,
  };
}
