import type { AnalysisInputDef } from '@interfaces';

// Shared across every script that reads it (see each script's `inputKeys`
// in `analysis-registry.ts`) - one value, applied everywhere it's supported.
export const GAP_INPUT: AnalysisInputDef = {
  key: 'gap',
  label: 'Gap window size',
  type: 'number',
  defaultValue: 4,
  min: 1,
};

export const LEVEL_INPUT: AnalysisInputDef = {
  key: 'level',
  label: 'Level',
  type: 'number',
  defaultValue: 50,
  min: 1,
  max: 99,
};

export const EXPANDED_INPUT: AnalysisInputDef = {
  key: 'expanded',
  label: 'Expanded detail',
  type: 'boolean',
  defaultValue: false,
};

export const CLASS_FILTER_INPUT: AnalysisInputDef = {
  key: 'classFilter',
  label: 'Class filter',
  type: 'jobMultiSelect',
  defaultValue: [],
};

export const MONSTER_FILTER_INPUT: AnalysisInputDef = {
  key: 'monsterFilter',
  label: 'Monster filter',
  type: 'monsterMultiSelect',
  defaultValue: [],
};

export const THRESHOLD_INPUT: AnalysisInputDef = {
  key: 'threshold',
  label: 'Under-utilized threshold',
  type: 'number',
  defaultValue: 1,
  min: 0,
};

export const GLOBAL_ANALYSIS_INPUTS: AnalysisInputDef[] = [
  GAP_INPUT,
  LEVEL_INPUT,
  EXPANDED_INPUT,
];

export const SCRIPT_ANALYSIS_INPUTS: AnalysisInputDef[] = [
  CLASS_FILTER_INPUT,
  MONSTER_FILTER_INPUT,
  THRESHOLD_INPUT,
];

export const ALL_ANALYSIS_INPUTS: AnalysisInputDef[] = [
  ...GLOBAL_ANALYSIS_INPUTS,
  ...SCRIPT_ANALYSIS_INPUTS,
];
