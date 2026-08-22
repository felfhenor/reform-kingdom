/**
 * Validates that every item, collectible, and equipment entry is obtainable
 * or explicitly marked `unobtainable: true`. Thin CLI wrapper - logic lives
 * in `src/app/helpers/debug/analysis-obtainability.ts`, shared with the
 * `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 */

import { runObtainabilityAnalysis } from '@helpers/debug/analysis-obtainability';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runObtainabilityAnalysis();
    printAnalysisResult('validate:obtainability', result, { strict: true });
  } catch (err) {
    console.error(`[validate:obtainability] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
