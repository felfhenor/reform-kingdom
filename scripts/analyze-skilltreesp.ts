/**
 * Counts each job tree's nodes by type and the SP a full build per spec costs
 * against the SP earned by the level cap. Thin CLI wrapper - logic lives in
 * `src/app/helpers/debug/analysis-skilltreesp.ts`, shared with the `/debug`
 * dashboard. Requires compiled content (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-skilltreesp
 */

import { runSkillTreeSpAnalysis } from '@helpers/debug/analysis-skilltreesp';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runSkillTreeSpAnalysis();
    printAnalysisResult('analyze:skilltreesp', result, { strict: false });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-skilltreesp');
    console.error(
      `[analyze:skilltreesp] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
