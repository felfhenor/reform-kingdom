/**
 * Single entrypoint for every content-validation check. Replaces the old
 * `concurrently`-driven fan-out across 16 separate `validate:x` npm scripts
 * (each its own ts-node process re-loading compiled content from disk) with
 * one process that loads it once and runs every check in-process.
 */

import type { AnalysisRunResult } from '@interfaces';
import { runFieldNodesAnalysis } from '@helpers/debug/analysis-fieldnodes';
import { runTeleportNodesAnalysis } from '@helpers/debug/analysis-teleportnodes';
import { runNodeNamesAnalysis } from '@helpers/debug/analysis-nodenames';
import { runCompletionRewardsAnalysis } from '@helpers/debug/analysis-completionrewards';
import { runRecipeRewardsAnalysis } from '@helpers/debug/analysis-reciperewards';
import { runRecipeNamesAnalysis } from '@helpers/debug/analysis-recipenames';
import { runObtainabilityAnalysis } from '@helpers/debug/analysis-obtainability';
import { runTradeskillXpGapsAnalysis } from '@helpers/debug/analysis-tradeskillxpgaps';
import { runRecipeIngredientOrderAnalysis } from '@helpers/debug/analysis-recipeingredientorder';
import { runSpritesAnalysis } from '@helpers/debug/analysis-sprites';
import { runCommissionUsageAnalysis } from '@helpers/debug/analysis-commissionusage';
import { runCommissionRewardsAnalysis } from '@helpers/debug/analysis-commissionrewards';
import { runGatherDevelopmentLevelsAnalysis } from '@helpers/debug/analysis-gatherdevelopmentlevels';
import { runTownMaterialThresholdsAnalysis } from '@helpers/debug/analysis-townmaterialthresholds';
import { runShrinesAnalysis } from '@helpers/debug/analysis-shrines';
import { runSkillsAnalysis } from '@helpers/debug/analysis-skills';
import { loadCompiledContentFromDisk } from './debug/load-compiled-content';
import { printAnalysisResult } from './debug/run-analysis-cli';
import { runSchemaValidation } from './debug/schema-validation';
import { runUnusedSpriteValidation } from './debug/unused-sprite-validation';

const ANALYSIS_CHECKS: Array<{ title: string; run: () => AnalysisRunResult }> = [
  { title: 'validate:fieldnodes', run: runFieldNodesAnalysis },
  { title: 'validate:teleportnodes', run: runTeleportNodesAnalysis },
  { title: 'validate:nodenames', run: runNodeNamesAnalysis },
  { title: 'validate:completionrewards', run: runCompletionRewardsAnalysis },
  { title: 'validate:reciperewards', run: runRecipeRewardsAnalysis },
  { title: 'validate:recipenames', run: runRecipeNamesAnalysis },
  { title: 'validate:obtainability', run: runObtainabilityAnalysis },
  { title: 'validate:tradeskillxpgaps', run: runTradeskillXpGapsAnalysis },
  {
    title: 'validate:recipeingredientorder',
    run: runRecipeIngredientOrderAnalysis,
  },
  { title: 'validate:sprites', run: runSpritesAnalysis },
  { title: 'validate:commissionusage', run: runCommissionUsageAnalysis },
  { title: 'validate:commissionrewards', run: runCommissionRewardsAnalysis },
  {
    title: 'validate:gatherdevelopmentlevels',
    run: runGatherDevelopmentLevelsAnalysis,
  },
  {
    title: 'validate:townmaterialthresholds',
    run: runTownMaterialThresholdsAnalysis,
  },
  { title: 'validate:shrines', run: runShrinesAnalysis },
  { title: 'validate:skills', run: runSkillsAnalysis },
];

async function main(): Promise<void> {
  let failed = false;

  try {
    loadCompiledContentFromDisk();
  } catch (err) {
    console.error(`[validate] FATAL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  ANALYSIS_CHECKS.forEach(({ title, run }) => {
    const result = run();
    printAnalysisResult(title, result, { strict: false });
    if (result.checks.some((check) => check.status === 'fail')) failed = true;
  });

  if ((await runSchemaValidation()).length > 0) failed = true;
  if ((await runUnusedSpriteValidation()).length > 0) failed = true;

  if (failed) {
    console.error('\n[validate] FAILED: one or more checks reported problems above.');
    process.exit(1);
  }

  console.log('\n[validate] PASSED: all checks succeeded.');
}

main();
