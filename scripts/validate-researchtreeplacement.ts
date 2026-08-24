/**
 * Validates that every research node is placed exactly once in a research
 * tree, with no dangling cells or row-ordering violations. Thin CLI wrapper
 * - logic lives in
 * `src/app/helpers/debug/analysis-researchtreeplacement.ts`, shared with the
 * `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 */

import { runResearchTreePlacementAnalysis } from '@helpers/debug/analysis-researchtreeplacement';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runResearchTreePlacementAnalysis();
    printAnalysisResult('validate:researchtreeplacement', result, {
      strict: true,
    });
  } catch (err) {
    console.error(`[validate:researchtreeplacement] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
