/**
 * Validates crafting recipe ordering (ingredient tradeskill levels, equipment
 * level requirements ascending with tradeskill level). Thin CLI wrapper -
 * logic lives in `src/app/helpers/debug/analysis-recipeingredientorder.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 */

import { runRecipeIngredientOrderAnalysis } from '@helpers/debug/analysis-recipeingredientorder';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runRecipeIngredientOrderAnalysis();
    printAnalysisResult('validate:recipeingredientorder', result, { strict: true });
  } catch (err) {
    console.error(`[validate:recipeingredientorder] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
