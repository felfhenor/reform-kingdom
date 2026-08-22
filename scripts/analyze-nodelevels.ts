/**
 * Lists level-gated world nodes and flags level-window coverage gaps. Thin
 * CLI wrapper - logic lives in `src/app/helpers/debug/analysis-nodelevels.ts`,
 * shared with the `/debug` dashboard. Requires compiled content and maps
 * (`npm run build`, or `gamedata:build` + `build:maps`).
 *
 * Usage: ts-node scripts/analyze-nodelevels [--gap=4]
 */

import { runNodeLevelsAnalysis } from '@helpers/debug/analysis-nodelevels';
import type { AnalysisParams } from '@interfaces';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function parseArgs(): AnalysisParams {
  const args = process.argv.slice(2);
  const gapArg = args.find((arg) => arg.startsWith('--gap='));
  const gap = gapArg ? Number(gapArg.split('=')[1]) : 4;
  return { gap };
}

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runNodeLevelsAnalysis(parseArgs());
    printAnalysisResult('analyze:nodelevels', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-nodelevels [--gap=4]');
    console.error(`[analyze:nodelevels] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
