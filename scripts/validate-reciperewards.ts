/**
 * Validates that every recipeId completion reward resolves to a real recipe.
 * Thin CLI wrapper - logic lives in `src/app/helpers/debug/analysis-reciperewards.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 */

import { runRecipeRewardsAnalysis } from '@helpers/debug/analysis-reciperewards';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runRecipeRewardsAnalysis();
    printAnalysisResult('validate:reciperewards', result, { strict: true });
  } catch (err) {
    console.error(`[validate:reciperewards] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
