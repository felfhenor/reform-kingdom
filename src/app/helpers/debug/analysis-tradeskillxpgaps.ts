/**
 * Validates that, for every tradeskill, there is no level between 1 and the
 * highest authored `minTradeskillLevel` where *no* recipe can grant XP - see
 * `craftXpChance` in `src/app/helpers/crafting.ts`, which
 * `recipeGrantsXpAtLevel` below mirrors. Ported from
 * `scripts/validate-tradeskillxpgaps.ts`.
 */

import { getEntriesByType } from '@helpers/content';
import type {
  AnalysisCheck,
  AnalysisRunResult,
  RecipeContent,
  TradeskillContent,
} from '@interfaces';

// See file header - mirrors `craftXpChance`, collapsed to a boolean ("can
// this recipe grant any XP at all at this building level").
function recipeGrantsXpAtLevel(recipe: RecipeContent, level: number): boolean {
  if (recipe.tradeskillXP <= 0) return false;

  const { minTradeskillLevel: min, maxTradeskillLevel: max } = recipe;
  if (level < min) return false;
  if (max <= min) return true;

  return level < max;
}

function checkTradeskill(
  tradeskill: TradeskillContent,
  recipes: RecipeContent[],
): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];

  const tradeskillRecipes = recipes.filter((r) => r.tradeskillId === tradeskill.id);
  const xpRecipes = tradeskillRecipes.filter((r) => r.tradeskillXP > 0);

  if (xpRecipes.length === 0) {
    checks.push({
      id: `xpgap:${tradeskill.id}`,
      label: tradeskill.name,
      status: 'fail',
      message: `${tradeskill.name} has no recipe that grants tradeskill XP at all - it can never be levelled.`,
    });
    return checks;
  }

  xpRecipes.forEach((recipe) => {
    if (recipe.minTradeskillLevel > recipe.maxTradeskillLevel) {
      checks.push({
        id: `xpgap:${tradeskill.id}:${recipe.id}`,
        label: recipe.name,
        status: 'fail',
        message: `${tradeskill.name} recipe "${recipe.name}" has minTradeskillLevel (${recipe.minTradeskillLevel}) greater than maxTradeskillLevel (${recipe.maxTradeskillLevel}).`,
      });
    }
  });

  const highestMinLevel = Math.max(...xpRecipes.map((r) => r.minTradeskillLevel));

  const gapLevels: number[] = [];
  for (let level = 1; level <= highestMinLevel; level += 1) {
    const covered = xpRecipes.some((recipe) => recipeGrantsXpAtLevel(recipe, level));
    if (!covered) gapLevels.push(level);
  }

  if (gapLevels.length > 0) {
    checks.push({
      id: `xpgap:${tradeskill.id}:coverage`,
      label: tradeskill.name,
      status: 'fail',
      message: `${tradeskill.name} has no XP-granting recipe covering level(s) ${gapLevels.join(', ')} (checked 1..${highestMinLevel}) - a building stuck there can never gain enough XP to progress toward level ${highestMinLevel}.`,
    });
  } else {
    checks.push({
      id: `xpgap:${tradeskill.id}:coverage`,
      label: tradeskill.name,
      status: 'pass',
      message: `${tradeskill.name}: levels 1..${highestMinLevel} are all covered by at least one XP-granting recipe (${xpRecipes.length} recipe(s) checked).`,
    });
  }

  return checks;
}

export function runTradeskillXpGapsAnalysis(): AnalysisRunResult {
  const recipes = getEntriesByType<RecipeContent>('recipe');
  const tradeskills = getEntriesByType<TradeskillContent>('tradeskill');

  const checks = tradeskills.flatMap((tradeskill) => checkTradeskill(tradeskill, recipes));
  const failures = checks.filter((c) => c.status === 'fail').length;

  return {
    checks,
    summary:
      failures === 0
        ? 'Every tradeskill has an unbroken XP path to its highest authored level.'
        : `${failures} problem(s) found.`,
  };
}
