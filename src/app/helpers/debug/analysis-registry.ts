import { runCommissionUsageAnalysis } from '@helpers/debug/analysis-commissionusage';
import { runCompletionRewardsAnalysis } from '@helpers/debug/analysis-completionrewards';
import { runContentGapsAnalysis } from '@helpers/debug/analysis-contentgaps';
import { runDebuffResistanceAnalysis } from '@helpers/debug/analysis-debuffresistance';
import { runFieldNodesAnalysis } from '@helpers/debug/analysis-fieldnodes';
import { runHeroStatsAnalysis } from '@helpers/debug/analysis-herostats';
import { runMaterialUtilizationAnalysis } from '@helpers/debug/analysis-materialutilization';
import { runMonsterStatsAnalysis } from '@helpers/debug/analysis-monsterstats';
import { runNodeLevelsAnalysis } from '@helpers/debug/analysis-nodelevels';
import { runNodeNamesAnalysis } from '@helpers/debug/analysis-nodenames';
import { runObtainabilityAnalysis } from '@helpers/debug/analysis-obtainability';
import { runRecipeIngredientOrderAnalysis } from '@helpers/debug/analysis-recipeingredientorder';
import { runRecipeNamesAnalysis } from '@helpers/debug/analysis-recipenames';
import { runRecipeRewardsAnalysis } from '@helpers/debug/analysis-reciperewards';
import { runSpritesAnalysis } from '@helpers/debug/analysis-sprites';
import { runTeleportNodesAnalysis } from '@helpers/debug/analysis-teleportnodes';
import { runTradeskillXpGapsAnalysis } from '@helpers/debug/analysis-tradeskillxpgaps';
import { runWorkerReachabilityAnalysis } from '@helpers/debug/analysis-workerreachability';
import { runWorkerStaminaAnalysis } from '@helpers/debug/analysis-workerstamina';
import type { AnalysisScriptDefinition } from '@interfaces';

// Every script the `/debug` dashboard and the `analyze:*`/`validate:*` CLI
// wrappers run. `inputKeys` drives which `AnalysisInputDef`s (see
// `analysis-inputs.ts`) this script reads and, in the dashboard, which
// scripts a shared input's help tooltip lists as supporting it. `category`
// drives which dashboard tab a script's section appears under - order here
// is the tab/section display order.
export const ANALYSIS_SCRIPTS: AnalysisScriptDefinition[] = [
  // --- Equipment & Items ---
  {
    id: 'contentgaps',
    title: 'Content Gaps',
    description:
      'Equipment/infusion/tradeskill recipe coverage across the level range the game spans.',
    category: 'Equipment & Items',
    strict: false,
    inputKeys: ['gap', 'expanded', 'level'],
    run: runContentGapsAnalysis,
  },
  {
    id: 'debuffresistance',
    title: 'Debuff Resistance',
    description:
      'Status-effect tag families, resistance sources, and level-window coverage.',
    category: 'Equipment & Items',
    strict: false,
    inputKeys: ['gap', 'level'],
    run: runDebuffResistanceAnalysis,
  },
  {
    id: 'materialutilization',
    title: 'Material Utilization',
    description:
      'How many systems consume each material, flagging under-utilized ones.',
    category: 'Equipment & Items',
    strict: false,
    inputKeys: ['expanded', 'threshold'],
    run: runMaterialUtilizationAnalysis,
  },
  {
    id: 'obtainability',
    title: 'Obtainability',
    description:
      'Every item/collectible/equipment is obtainable or marked unobtainable.',
    category: 'Equipment & Items',
    strict: true,
    inputKeys: [],
    run: runObtainabilityAnalysis,
  },
  {
    id: 'sprites',
    title: 'Sprites',
    description: 'Sprite indices are unique within each content type.',
    category: 'Equipment & Items',
    strict: true,
    inputKeys: [],
    run: runSpritesAnalysis,
  },

  // --- Tradeskills & Recipes ---
  {
    id: 'recipeingredientorder',
    title: 'Recipe Ingredient Order',
    description: 'Ingredient recipes unlock at or before recipes that consume them.',
    category: 'Tradeskills & Recipes',
    strict: true,
    inputKeys: [],
    run: runRecipeIngredientOrderAnalysis,
  },
  {
    id: 'recipenames',
    title: 'Recipe Names',
    description: 'Recipe names are prefixed according to their result type.',
    category: 'Tradeskills & Recipes',
    strict: true,
    inputKeys: [],
    run: runRecipeNamesAnalysis,
  },
  {
    id: 'reciperewards',
    title: 'Recipe Rewards',
    description: 'Every recipeId completion reward resolves to a real recipe.',
    category: 'Tradeskills & Recipes',
    strict: true,
    inputKeys: [],
    run: runRecipeRewardsAnalysis,
  },
  {
    id: 'tradeskillxpgaps',
    title: 'Tradeskill XP Gaps',
    description:
      'Every tradeskill has an unbroken XP path to its highest authored level.',
    category: 'Tradeskills & Recipes',
    strict: true,
    inputKeys: [],
    run: runTradeskillXpGapsAnalysis,
  },

  // --- World & Maps ---
  {
    id: 'nodelevels',
    title: 'Node Levels',
    description: 'Level-gated world nodes by map, flagging level-window coverage gaps.',
    category: 'World & Maps',
    strict: false,
    inputKeys: ['gap'],
    run: runNodeLevelsAnalysis,
  },
  {
    id: 'nodenames',
    title: 'Node Names',
    description: 'Every map node name is unique across all maps.',
    category: 'World & Maps',
    strict: true,
    inputKeys: [],
    run: runNodeNamesAnalysis,
  },
  {
    id: 'teleportnodes',
    title: 'Teleport Nodes',
    description: 'Teleport node tags/toTags are present, unique, and resolve.',
    category: 'World & Maps',
    strict: true,
    inputKeys: [],
    run: runTeleportNodesAnalysis,
  },
  {
    id: 'completionrewards',
    title: 'Completion Rewards',
    description:
      'Every explore node resolves to an encounter with a collectible completion reward.',
    category: 'World & Maps',
    strict: true,
    inputKeys: [],
    run: runCompletionRewardsAnalysis,
  },
  {
    id: 'fieldnodes',
    title: 'Field Nodes',
    description:
      'Every field node has a matching encounter, random encounter, or gathering entry.',
    category: 'World & Maps',
    strict: true,
    inputKeys: [],
    run: runFieldNodesAnalysis,
  },
  {
    id: 'workerstamina',
    title: 'Worker Stamina',
    description:
      'One-way travel-tick cost from the Kingdom to every gather node, for worker stamina calibration.',
    category: 'World & Maps',
    strict: false,
    inputKeys: [],
    run: runWorkerStaminaAnalysis,
  },
  {
    id: 'workerreachability',
    title: 'Worker Reachability',
    description:
      'Every gather node is reachable by at least one worker, and no worker stalls before the content-wide level cap.',
    category: 'World & Maps',
    strict: false,
    inputKeys: [],
    run: runWorkerReachabilityAnalysis,
  },

  // --- Caravans & Commissions ---
  {
    id: 'commissionusage',
    title: 'Commission Usage',
    description: 'Every commission offer is referenced by at least one caravan.',
    category: 'Caravans & Commissions',
    strict: true,
    inputKeys: [],
    run: runCommissionUsageAnalysis,
  },

  // --- Hero Stats ---
  {
    id: 'herostats',
    title: 'Hero Stats',
    description: 'MIN/MID/MAX hero stats and skill damage/heal estimates at a level.',
    category: 'Hero Stats',
    strict: false,
    inputKeys: ['level', 'classFilter'],
    run: runHeroStatsAnalysis,
  },

  // --- Monster Stats ---
  {
    id: 'monsterstats',
    title: 'Monster Stats',
    description: 'Monster stat blocks at a given level.',
    category: 'Monster Stats',
    strict: false,
    inputKeys: ['level', 'monsterFilter'],
    run: runMonsterStatsAnalysis,
  },
];
