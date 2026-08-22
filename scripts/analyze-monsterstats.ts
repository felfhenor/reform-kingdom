/**
 * Reports monster stats at a given level. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-monsterstats.ts`, shared with the
 * `/debug` dashboard. Requires compiled content (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-monsterstats <level 1-99> [monster1,monster2,...]
 */

import { runMonsterStatsAnalysis } from '@helpers/debug/analysis-monsterstats';
import type { AnalysisParams } from '@interfaces';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function parseArgs(): AnalysisParams {
  const level = Number(process.argv[2]);
  const monsterFilter = process.argv[3]?.split(',').map((name) => name.trim());
  return { level, monsterFilter };
}

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runMonsterStatsAnalysis(parseArgs());
    printAnalysisResult('analyze:monsterstats', result, { strict: false });
  } catch (err) {
    console.error(
      'Usage: ts-node scripts/analyze-monsterstats <level 1-99> [monster1,monster2,...]',
    );
    console.error(`[analyze:monsterstats] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
