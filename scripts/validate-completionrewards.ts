/**
 * Validates that every explore node resolves to an encounter with a
 * collectible completion reward. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-completionrewards.ts`, shared with the
 * `/debug` dashboard. Requires compiled content and maps (`npm run build`).
 */

import { runCompletionRewardsAnalysis } from '@helpers/debug/analysis-completionrewards';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runCompletionRewardsAnalysis();
    printAnalysisResult('validate:completionrewards', result, { strict: true });
  } catch (err) {
    console.error(`[validate:completionrewards] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
