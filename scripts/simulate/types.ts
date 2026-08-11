import type { JobId } from '@interfaces';

export type StrategyName = 'optimal' | 'average' | 'suboptimal';

export type PartyComp = {
  label: string;
  jobNames: string[];
};

export type ScenarioConfig = {
  comp: PartyComp;
  strategy: StrategyName;
  trial: number;
  tickBudget: number;
};

export type StonewallKind = 'HardStonewall' | 'XpDecay' | 'SupplyStall';

export type StonewallEvent = {
  kind: StonewallKind;
  tick: number;
  detail: string;
};

export type TerminalReason = 'MaxLevel' | 'TickBudget' | 'Stonewall';

export type SimResult = {
  scenario: ScenarioConfig;
  finalTick: number;
  terminalReason: TerminalReason;
  finalPartyLevel: number;
  stonewalls: StonewallEvent[];
};

export type RunOptions = {
  mode: 'curated' | 'exhaustive';
  trials: number;
  tickBudget: number;
  strategies: StrategyName[];
  verbose: boolean;
};

// Resolved job content, keyed by the job name strings used in `PartyComp`.
export type JobIdByName = Map<string, JobId>;
