/**
 * Validates that sprite indices are unique within each content type. Thin
 * CLI wrapper - logic lives in `src/app/helpers/debug/analysis-sprites.ts`,
 * shared with the `/debug` dashboard. Requires compiled content
 * (`npm run gamedata:build`).
 */

import { runSpritesAnalysis } from '@helpers/debug/analysis-sprites';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runSpritesAnalysis();
    printAnalysisResult('validate:sprites', result, { strict: true });
  } catch (err) {
    console.error(`[validate:sprites] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
