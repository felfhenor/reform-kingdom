import type { JobId } from '@interfaces';

export type StrategyName = 'periodic-craft' | 'always-craft';

export type PartyComp = {
  label: string;
  jobNames: string[];
};

export type ScenarioConfig = {
  comp: PartyComp;
  strategy: StrategyName;
  trial: number;
  tickBudget: number;
  // Resume from this dumped `GameState` instead of starting a fresh game.
  seedPath?: string;
  // Write a seed checkpoint to this directory every `dumpIntervalLevels`.
  dumpSeedsDir?: string;
  dumpIntervalLevels?: number;
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
  workers: number;
  dumpSeeds: boolean;
  dumpIntervalLevels: number;
  // Resume exactly this one seed file.
  resumeSeed?: string;
  // Resume every seed file at this level (searches `resumeSeedsDir`, or the most recently dumped run if unset).
  resumeLevel?: number;
  resumeSeedsDir?: string;
};

// Resolved job content, keyed by the job name strings used in `PartyComp`.
export type JobIdByName = Map<string, JobId>;
