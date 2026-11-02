import type { EdictId } from '@interfaces/content-edict';
import type { JobId } from '@interfaces/content-job';
import type { RemembranceCategory } from '@interfaces/remembrance';
import type { GameId } from '@interfaces/state-game';

export type RunOutcome = 'Completed' | 'Abandoned';

export type RunRecordHero = {
  name: string;
  jobId: JobId;
  level: number;
};

export type RunRecordStats = {
  kills: number;
  monstersKilled: number;
  mapsReached: number;
  townsVisited: number;
  completion: RemembranceCategory[];
};

// Fragments and multiplier are kept as they were when the run ended, so rebalancing edicts never rewrites old runs.
export type RunRecord = {
  id: GameId;
  outcome: RunOutcome;
  startedAt: number;
  endedAt: number;
  ticks: number;
  party: RunRecordHero[];
  edicts: EdictId[];
  fragments: number;
  multiplier: number;
  stats: RunRecordStats;
};

export type LegacyState = {
  version: number;
  runs: RunRecord[];
};

export type LegacyMergeResult = 'merged' | 'unchanged' | 'invalid' | 'unsaved';
