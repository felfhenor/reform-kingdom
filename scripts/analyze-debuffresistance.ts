/**
 * Reports on the debuff-resistance tag system. Thin CLI wrapper - logic
 * lives in `src/app/helpers/debug/analysis-debuffresistance.ts`, shared with
 * the `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-debuffresistance [--gap=4]
 */

import { runDebuffResistanceAnalysis } from '@helpers/debug/analysis-debuffresistance';
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
    const result = runDebuffResistanceAnalysis(parseArgs());
    printAnalysisResult('analyze:debuffresistance', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-debuffresistance [--gap=4]');
    console.error(`[analyze:debuffresistance] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
