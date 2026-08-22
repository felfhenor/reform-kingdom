/**
 * Validates that every field node has a matching encounter, random
 * encounter, or gathering entry. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-fieldnodes.ts`, shared with the `/debug`
 * dashboard. Requires compiled content and maps (`npm run build`).
 */

import { runFieldNodesAnalysis } from '@helpers/debug/analysis-fieldnodes';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runFieldNodesAnalysis();
    printAnalysisResult('validate:fieldnodes', result, { strict: true });
  } catch (err) {
    console.error(`[validate:fieldnodes] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
