/**
 * Validates that every map node name is unique across all maps. Thin CLI
 * wrapper - logic lives in `src/app/helpers/debug/analysis-nodenames.ts`,
 * shared with the `/debug` dashboard. Requires compiled maps
 * (`npm run build:maps`).
 */

import { runNodeNamesAnalysis } from '@helpers/debug/analysis-nodenames';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runNodeNamesAnalysis();
    printAnalysisResult('validate:nodenames', result, { strict: true });
  } catch (err) {
    console.error(`[validate:nodenames] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
