// Validates every commission offer is used by a caravan. Logic lives in
// src/app/helpers/debug/analysis-commissionusage.ts (shared with /debug).

import { runCommissionUsageAnalysis } from '@helpers/debug/analysis-commissionusage';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runCommissionUsageAnalysis();
    printAnalysisResult('validate:commissionusage', result, { strict: true });
  } catch (err) {
    console.error(
      `[validate:commissionusage] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
