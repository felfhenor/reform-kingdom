import type { EdictId } from '@interfaces/content-edict';
import type { JobId } from '@interfaces/content-job';
import type { RemembranceCategory } from '@interfaces/remembrance';
import type { HeroRunStats, RunStatsTotals } from '@interfaces/run-stats';
import type { GameId } from '@interfaces/state-game';

export type RunOutcome = 'Completed' | 'Lost' | 'Abandoned';

// Name and sprite are copied, not an id, so a renamed node can't break an old run.
export type RunRecordArt = {
  name: string;
  sprite: string;
};

export type RunRecordHeroSnapshot = {
  specialization?: RunRecordArt;
  jobsUsed: JobId[];
};

// `stats` and `snapshot` are missing on runs recorded before run stats were tracked.
export type RunRecordHero = {
  name: string;
  jobId: JobId;
  level: number;
  stats?: HeroRunStats;
  snapshot?: RunRecordHeroSnapshot;
};

export type RunRecordStats = {
  kills: number;
  monstersKilled: number;
  mapsReached: number;
  townsVisited: number;
  completion: RemembranceCategory[];
  // Missing on runs recorded before run stats were tracked.
  run?: RunStatsTotals;
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
