/**
 * Reports material utilization and flags under-utilized materials. Thin CLI
 * wrapper - logic lives in `src/app/helpers/debug/analysis-materialutilization.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-materialutilization [--expanded] [threshold=1]
 */

import { runMaterialUtilizationAnalysis } from '@helpers/debug/analysis-materialutilization';
import type { AnalysisParams } from '@interfaces';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function parseArgs(): AnalysisParams {
  const args = process.argv.slice(2);
  const expanded = args.includes('--expanded');
  const thresholdArg = args.find((arg) => arg !== '--expanded');
  const threshold = thresholdArg !== undefined ? Number(thresholdArg) : 1;
  return { expanded, threshold };
}

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runMaterialUtilizationAnalysis(parseArgs());
    printAnalysisResult('analyze:materialutilization', result, { strict: false });
  } catch (err) {
    console.error(
      'Usage: ts-node scripts/analyze-materialutilization [--expanded] [threshold=1]',
    );
    console.error(`[analyze:materialutilization] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
