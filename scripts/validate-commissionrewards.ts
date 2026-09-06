// Validates every commission offer has both a town reputation reward and a
// normal rewards list. Logic lives in
// src/app/helpers/debug/analysis-commissionrewards.ts (shared with /debug).

import { runCommissionRewardsAnalysis } from '@helpers/debug/analysis-commissionrewards';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runCommissionRewardsAnalysis();
    printAnalysisResult('validate:commissionrewards', result, { strict: true });
  } catch (err) {
    console.error(
      `[validate:commissionrewards] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
