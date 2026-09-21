/**
 * Reports tradeskill levels with no newly-introduced recipe. Thin CLI wrapper -
 * the actual logic lives in `src/app/helpers/debug/analysis-tradeskillgaps.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-tradeskillgaps [--level=<x>] [--expanded]
 * `--level` defaults to the highest recipe unlock level.
 */

import { runTradeskillGapsAnalysis } from '@helpers/debug/analysis-tradeskillgaps';
import type { AnalysisParams } from '@interfaces';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function parseArgs(): AnalysisParams {
  const args = process.argv.slice(2);
  const expanded = args.includes('--expanded');
  const levelArg = args.find((arg) => arg.startsWith('--level='));
  const tradeskillLevel = levelArg ? Number(levelArg.split('=')[1]) : undefined;
  return { tradeskillLevel, expanded };
}

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runTradeskillGapsAnalysis(parseArgs());
    printAnalysisResult('analyze:tradeskillgaps', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-tradeskillgaps [--level=<x>] [--expanded]');
    console.error(`[analyze:tradeskillgaps] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
