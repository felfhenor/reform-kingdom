/**
 * Lists every gather node's one-way travel-tick cost from the Kingdom, for
 * calibrating worker stamina stats. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-workerstamina.ts`, shared with the
 * `/debug` dashboard. Requires compiled content and maps (`npm run build`,
 * or `gamedata:build` + `build:maps`).
 *
 * Usage: ts-node scripts/analyze-workerstamina
 */

import { runWorkerStaminaAnalysis } from '@helpers/debug/analysis-workerstamina';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runWorkerStaminaAnalysis();
    printAnalysisResult('analyze:workerstamina', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-workerstamina');
    console.error(
      `[analyze:workerstamina] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
