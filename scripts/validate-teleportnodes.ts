/**
 * Validates that every teleport node's tag/toTag properties are present,
 * unique, and resolve. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-teleportnodes.ts`, shared with the
 * `/debug` dashboard. Requires compiled maps (`npm run build:maps`).
 */

import { runTeleportNodesAnalysis } from '@helpers/debug/analysis-teleportnodes';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runTeleportNodesAnalysis();
    printAnalysisResult('validate:teleportnodes', result, { strict: true });
  } catch (err) {
    console.error(`[validate:teleportnodes] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
