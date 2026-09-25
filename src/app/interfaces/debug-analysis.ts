import type { HasSprite } from '@interfaces/artable';
import type { JobContent } from '@interfaces/content-job';
import type { EquipmentSkillContent } from '@interfaces/content-skill';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { SkillStatBonus } from '@interfaces/stat';
import type { TiledObject } from '@interfaces/tiled-map';

export type AnalysisInputType =
  'number' | 'boolean' | 'text' | 'jobMultiSelect' | 'monsterMultiSelect';

export type AnalysisInputValue = number | boolean | string | string[];

export type AnalysisInputDef = {
  key: string;
  label: string;
  type: AnalysisInputType;
  defaultValue: AnalysisInputValue;
  min?: number;
  max?: number;
};

export type AnalysisParams = Record<string, AnalysisInputValue | undefined>;

export type AnalysisCheckStatus = 'pass' | 'fail' | 'warning' | 'info';

export type AnalysisCheck = {
  id: string;
  label: string;
  status: AnalysisCheckStatus;
  message: string;
};

export type AnalysisTable = {
  title: string;
  columns: string[];
  rows: Record<string, string | number>[];
};

export type AnalysisRunResult = {
  checks: AnalysisCheck[];
  tables?: AnalysisTable[];
  summary: string;
};

export type AnalysisScriptCategory =
  | 'Equipment & Items'
  | 'Tradeskills & Recipes'
  | 'World & Maps'
  | 'Caravans & Commissions'
  | 'Skills'
  | 'Hero Stats'
  | 'Monster Stats';

export type AnalysisScriptDefinition = {
  id: string;
  title: string;
  description: string;
  category: AnalysisScriptCategory;
  strict: boolean;
  inputKeys: string[];
  run: (params: AnalysisParams) => AnalysisRunResult;
};

// --- Kept here per project convention (no types declared inside helper files).

export type AnalysisLevelWindow = { start: number; end: number };

export type AnalysisItemSource = { level: number };

export type MaterialUtilizationStats = {
  name: string;
  rarity: string;
  unobtainable: boolean;
  infusable: boolean;
  craftedFrom: number;
  craftedFromQuantity: number;
  craftedInto: number;
  monsterDrops: number;
  encounterRewards: number;
  gatherSources: number;
  caravanBuys: number;
  caravanSells: number;
  astralCasts: number;
  commissionRequirements: number;
  commissionRewards: number;
  traderTokenSinks: number;
  nodeUpgradeCosts: number;
  shrineCosts: number;
  trainerCosts: number;
};

export type NodeLevelCheckEntry = {
  name: string;
  kind: string;
  levelRange: LevelRange;
  mapName: string;
};

export type WorkerStaminaCheckEntry = {
  name: string;
  mapName: string;
  oneWayTicks?: number;
};

// A gather node's stamina cost and worker level window, as seen by the reachability analysis.
export type WorkerReachabilityNode = {
  nodeName: string;
  mapName: string;
  oneWayTicks?: number;
  levelRange: LevelRange;
};

export type WorkerReachabilityCheckEntry = {
  workerName: string;
  nodeName: string;
  mapName: string;
  oneWayTicks?: number;
  // Undefined unless the worker's own leveling progression actually reaches this level.
  reachableAtLevel?: number;
  levelRange: LevelRange;
};

// One worker whose leveling stalls short of the content-wide ideal cap, and why.
export type WorkerLevelingGapEntry = {
  workerName: string;
  stuckAtLevel: number;
  blockingNodeName?: string;
  blockingNodeLevelRange?: LevelRange;
  workerStaminaAtStuckLevel: number;
  blockingNodeStaminaCost?: number;
};

export type MapNodeCheckRef = {
  mapName: string;
  node: TiledObject;
};

export type TeleportNodeCheckRef = {
  mapName: string;
  nodeName: string;
  tag?: string;
  toTag?: string;
};

export type RecipeItemProducer = {
  name: string;
  tradeskillId: string;
  minTradeskillLevel: number;
};

export type EquipmentResultRecipeCheck = {
  name: string;
  minTradeskillLevel: number;
  levelRequirement: number;
};

export type SpritedContentEntry = IsContentItem & HasSprite;

export type AnalysisIssue = { status: 'fail' | 'warning'; message: string };

// Anything that can carry skill stat bonuses.
export type SkillStatBonusSource = {
  id: string;
  label: string;
  bonuses: SkillStatBonus[];
  // Gear only - its bonuses help only jobs that can equip the type.
  equipment?: { type: EquipmentItemType; grantedSkillIds: string[] };
  // Affix `family`, set only for affixes.
  affixFamily?: string;
  // Set only for affixes.
  affixLevelRequirement?: number;
};

export type SkillStatBonusContext = {
  skillsByFamily: Map<string, EquipmentSkillContent[]>;
  heroFamilies: Set<string>;
  jobs: JobContent[];
};

export type SkillSourceKind = 'Job' | 'Monster' | 'Equipment' | 'Affix';

export type SkillSource = { kind: SkillSourceKind; name: string };

export type SkillReference = { skillRef: string; source: SkillSource };
