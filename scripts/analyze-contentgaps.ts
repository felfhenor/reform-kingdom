/**
 * Reports gaps in item/equipment/infusion content across the level range the
 * game actually spans. Thin CLI wrapper - the actual logic lives in
 * `src/app/helpers/debug/analysis-contentgaps.ts`, shared with the `/debug`
 * dashboard. Requires compiled content (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-contentgaps [--gap=4] [--expanded]
 */

import { runContentGapsAnalysis } from '@helpers/debug/analysis-contentgaps';
import type { AnalysisParams } from '@interfaces';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function parseArgs(): AnalysisParams {
  const args = process.argv.slice(2);
  const expanded = args.includes('--expanded');
  const gapArg = args.find((arg) => arg.startsWith('--gap='));
  const gap = gapArg ? Number(gapArg.split('=')[1]) : 4;
  return { gap, expanded };
}

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runContentGapsAnalysis(parseArgs());
    printAnalysisResult('analyze:contentgaps', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-contentgaps [--gap=4] [--expanded]');
    console.error(`[analyze:contentgaps] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
