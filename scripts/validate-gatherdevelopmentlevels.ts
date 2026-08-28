/**
 * Validates that every GatherNode development level has at least one
 * available gatherResults entry. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-gatherdevelopmentlevels.ts`, shared with
 * the `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 */

import { runGatherDevelopmentLevelsAnalysis } from '@helpers/debug/analysis-gatherdevelopmentlevels';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runGatherDevelopmentLevelsAnalysis();
    printAnalysisResult('validate:gatherdevelopmentlevels', result, {
      strict: true,
    });
  } catch (err) {
    console.error(
      `[validate:gatherdevelopmentlevels] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
