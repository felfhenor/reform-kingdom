/**
 * Audits skill tagging, families/tiers, and assignment to jobs, monsters, and
 * equipment. Thin CLI wrapper - the logic lives in
 * `src/app/helpers/debug/analysis-skills.ts`, shared with the `/debug`
 * dashboard and `npm run validate`. Requires compiled content
 * (`npm run gamedata:build`).
 *
 * Usage: ts-node scripts/analyze-skills [--expanded]
 */

import { runSkillsAnalysis } from '@helpers/debug/analysis-skills';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const expanded = process.argv.includes('--expanded');
    const result = runSkillsAnalysis({ expanded });
    printAnalysisResult('analyze:skills', result, { strict: true });
  } catch (err) {
    console.error('Usage: ts-node scripts/analyze-skills [--expanded]');
    console.error(
      `[analyze:skills] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
