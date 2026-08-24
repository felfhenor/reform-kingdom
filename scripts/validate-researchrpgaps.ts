/**
 * Validates that every research node is affordable within total obtainable
 * Insight Crystals, with no prerequisite cycles or dangling references.
 * Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-researchrpgaps.ts`, shared with the
 * `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 */

import { runResearchRpGapsAnalysis } from '@helpers/debug/analysis-researchrpgaps';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runResearchRpGapsAnalysis();
    printAnalysisResult('validate:researchrpgaps', result, { strict: true });
  } catch (err) {
    console.error(`[validate:researchrpgaps] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
