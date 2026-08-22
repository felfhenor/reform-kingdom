/**
 * Validates that every tradeskill has an unbroken XP path to its highest
 * authored level. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-tradeskillxpgaps.ts`, shared with the
 * `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 */

import { runTradeskillXpGapsAnalysis } from '@helpers/debug/analysis-tradeskillxpgaps';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runTradeskillXpGapsAnalysis();
    printAnalysisResult('validate:tradeskillxpgaps', result, { strict: true });
  } catch (err) {
    console.error(`[validate:tradeskillxpgaps] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
