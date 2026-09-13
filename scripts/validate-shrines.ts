/**
 * Validates that every shrine has at least one level, each level's buff is
 * flagged isShrineBuff, and no two shrine levels share a globalEffectId.
 * Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-shrines.ts`, shared with the `/debug`
 * dashboard. Requires compiled content (`npm run gamedata:build`).
 */

import { runShrinesAnalysis } from '@helpers/debug/analysis-shrines';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runShrinesAnalysis();
    printAnalysisResult('validate:shrines', result, { strict: true });
  } catch (err) {
    console.error(
      `[validate:shrines] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
