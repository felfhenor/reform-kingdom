/**
 * Reports tradeskill levels with no newly-introduced recipe, up to a
 * tradeskill level (not the hero level the other gap analyses scale off).
 */

import { TRADESKILL_MAX_LEVEL } from '@helpers/config';
import { getEntriesByType } from '@helpers/content/content';
import { formatWindows, gapWindows } from '@helpers/debug/analysis-utils';
import type {
  AnalysisCheck,
  AnalysisParams,
  AnalysisRunResult,
  EncounterContent,
  EncounterRandomContent,
  RecipeContent,
  TradeskillContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Highest level any recipe unlocks at (its min, not the level it stops granting XP).
export function highestTradeskillMinLevel(recipes: RecipeContent[]): number {
  return Math.max(1, ...recipes.map((r) => r.minTradeskillLevel));
}

function dropGatedRecipeIds(
  encounters: (EncounterContent | EncounterRandomContent)[],
): Set<string> {
  const ids = new Set<string>();
  encounters.forEach((encounter) => {
    encounter.completionRewards.forEach((reward) => {
      if ('recipeId' in reward) ids.add(reward.recipeId);
    });
  });
  return ids;
}

function tradeskillChecks(
  tradeskill: TradeskillContent,
  entries: RecipeContent[],
  tradeskillLevel: number,
  dropGated: Set<string>,
  expanded: boolean,
): AnalysisCheck[] {
  if (entries.length === 0) {
    return [
      {
        id: `tradeskill:${tradeskill.id}`,
        label: `Tradeskill: ${tradeskill.name}`,
        status: 'warning',
        message: `Tradeskill "${tradeskill.name}" has no recipes at all.`,
      },
    ];
  }

  const windows = gapWindows(
    entries.map((r) => r.minTradeskillLevel),
    tradeskillLevel,
    1,
  );
  const checks: AnalysisCheck[] = [
    windows.length > 0
      ? {
          id: `tradeskill:${tradeskill.id}`,
          label: `Tradeskill: ${tradeskill.name}`,
          status: 'warning',
          message: `Tradeskill "${tradeskill.name}" has no new recipe introduced at level(s): ${formatWindows(windows)} (checked 1..${tradeskillLevel}, ${entries.length} recipe(s) total).`,
        }
      : {
          id: `tradeskill:${tradeskill.id}`,
          label: `Tradeskill: ${tradeskill.name}`,
          status: 'pass',
          message: `${tradeskill.name}: levels 1..${tradeskillLevel} each have at least one new recipe (${entries.length} recipe(s) total).`,
        },
  ];

  if (expanded) {
    sortBy(entries, [(r) => r.minTradeskillLevel]).forEach((r) => {
      const gate = dropGated.has(r.id) ? 'found' : 'learned';
      checks.push({
        id: `tradeskill:${tradeskill.id}:${r.id}`,
        label: r.name,
        status: 'info',
        message: `Lv${r.minTradeskillLevel}: ${r.name} [${gate}]`,
      });
    });
  }

  return checks;
}

export function runTradeskillGapsAnalysis(
  params: AnalysisParams,
): AnalysisRunResult {
  const expanded = !!params['expanded'];
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const tradeskills = getEntriesByType<TradeskillContent>('tradeskill');

  const tradeskillLevel =
    params['tradeskillLevel'] !== undefined
      ? Number(params['tradeskillLevel'])
      : highestTradeskillMinLevel(recipes);
  if (
    !Number.isInteger(tradeskillLevel) ||
    tradeskillLevel < 1 ||
    tradeskillLevel > TRADESKILL_MAX_LEVEL
  ) {
    throw new Error(
      `"tradeskillLevel" must be an integer from 1 to ${TRADESKILL_MAX_LEVEL}, got ${tradeskillLevel}.`,
    );
  }

  const dropGated = dropGatedRecipeIds([
    ...getEntriesByType<EncounterContent>('encounter'),
    ...getEntriesByType<EncounterRandomContent>('encounterrandom'),
  ]);

  const checks = tradeskills.flatMap((tradeskill) =>
    tradeskillChecks(
      tradeskill,
      recipes.filter((r) => r.tradeskillId === tradeskill.id),
      tradeskillLevel,
      dropGated,
      expanded,
    ),
  );
  const warnings = checks.filter((c) => c.status === 'warning').length;

  return {
    checks,
    summary:
      warnings === 0
        ? 'No tradeskill gaps found.'
        : `${warnings} tradeskill gap warning(s) found.`,
  };
}
