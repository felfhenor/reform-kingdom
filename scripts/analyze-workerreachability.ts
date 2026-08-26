/**
 * Flags gather nodes no worker can ever reach, and workers whose leveling
 * stalls before the content-wide level cap. Thin CLI wrapper - logic lives
 * in `src/app/helpers/debug/analysis-workerreachability.ts`, shared with
 * the `/debug` dashboard. Requires compiled content and maps (`npm run
 * build`, or `gamedata:build` + `build:maps`).
 *
 * Usage: ts-node scripts/analyze-workerreachability
 */

import { runWorkerReachabilityAnalysis } from '@helpers/debug/analysis-workerreachability';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runWorkerReachabilityAnalysis();
    printAnalysisResult('analyze:workerreachability', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-workerreachability');
    console.error(
      `[analyze:workerreachability] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
