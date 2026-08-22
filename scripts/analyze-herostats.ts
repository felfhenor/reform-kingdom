/**
 * Reports MIN/MID/MAX hero stats and skill damage/heal estimates at a level.
 * Thin CLI wrapper - logic lives in `src/app/helpers/debug/analysis-herostats.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-herostats <level 1-99> [class1,class2,...]
 */

import { runHeroStatsAnalysis } from '@helpers/debug/analysis-herostats';
import type { AnalysisParams } from '@interfaces';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function parseArgs(): AnalysisParams {
  const level = Number(process.argv[2]);
  const classFilter = process.argv[3]?.split(',').map((name) => name.trim());
  return { level, classFilter };
}

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runHeroStatsAnalysis(parseArgs());
    printAnalysisResult('analyze:herostats', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-herostats <level 1-99> [class1,class2,...]');
    console.error(`[analyze:herostats] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
