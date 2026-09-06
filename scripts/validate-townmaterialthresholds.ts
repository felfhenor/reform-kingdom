// Validates every item a town's assigned commissions request has a materialThresholds
// entry for that town. Logic lives in
// src/app/helpers/debug/analysis-townmaterialthresholds.ts (shared with /debug).

import { runTownMaterialThresholdsAnalysis } from '@helpers/debug/analysis-townmaterialthresholds';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';

function main(): void {
  try {
    loadCompiledContentFromDisk();
    const result = runTownMaterialThresholdsAnalysis();
    printAnalysisResult('validate:townmaterialthresholds', result, {
      strict: true,
    });
  } catch (err) {
    console.error(
      `[validate:townmaterialthresholds] FATAL: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }
}

main();
