/**
 * Validates that every recipe name is prefixed according to its result type.
 * Thin CLI wrapper - logic lives in `src/app/helpers/debug/analysis-recipenames.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 */

import { runRecipeNamesAnalysis } from '@helpers/debug/analysis-recipenames';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runRecipeNamesAnalysis();
    printAnalysisResult('validate:recipenames', result, { strict: true });
  } catch (err) {
    console.error(`[validate:recipenames] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
