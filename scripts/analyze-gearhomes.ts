/**
 * Lists each map's home gear for the region gear drop effect (Edict of
 * Spontaneous Memory). Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-gearhomes.ts`, shared with the `/debug`
 * dashboard. Requires compiled content and maps (`npm run build`, or
 * `gamedata:build` + `build:maps`).
 *
 * Usage: ts-node scripts/analyze-gearhomes
 */

import { runGearHomesAnalysis } from '@helpers/debug/analysis-gearhomes';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runGearHomesAnalysis();
    printAnalysisResult('analyze:gearhomes', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-gearhomes');
    console.error(
      `[analyze:gearhomes] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
