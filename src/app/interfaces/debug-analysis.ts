import type { HasSprite } from '@interfaces/artable';
import type { IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { TiledObject } from '@interfaces/tiled-map';

export type AnalysisInputType =
  | 'number'
  | 'boolean'
  | 'text'
  | 'jobMultiSelect'
  | 'monsterMultiSelect';

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
  | 'Hero Stats'
  | 'Monster Stats'
  | 'Research';

export type AnalysisScriptDefinition = {
  id: string;
  title: string;
  description: string;
  category: AnalysisScriptCategory;
  strict: boolean;
  inputKeys: string[];
  run: (params: AnalysisParams) => AnalysisRunResult;
  // Reads live gamestate() - browser/`/debug`-dashboard only. Never give a
  // script with this flag a scripts/validate-*.ts CLI wrapper; it has no
  // save file to load outside the Angular app.
  usesGamestate?: true;
};

// --- Local shapes used by `src/app/helpers/debug/analysis-*.ts` - kept here
// per project convention (no types declared inside helper files).

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
};

export type NodeLevelCheckEntry = {
  name: string;
  kind: string;
  levelRange: LevelRange;
  mapName: string;
};

export type MapNodeCheckRef = {
  mapName: string;
  node: TiledObject;
};

export type TeleportNodeCheckRef = {
  mapName: string;
  nodeName: string;
  tag: string | undefined;
  toTag: string | undefined;
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
