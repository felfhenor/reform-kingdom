import type { RegionContent } from '@interfaces/content-region';
import type { HeroRunStats } from '@interfaces/run-stats';

export type RunStatRow = {
  label: string;
  value: number;
};

export type RunMostUsedSkill = {
  skillFamily: string;
  uses: number;
};

export type RunAwardDefinition = {
  label: string;
  value: (stats: HeroRunStats) => number;
};

export type RunAward = {
  label: string;
  heroIndex: number;
};

export type RunScoreSeal = {
  region: RegionContent;
  tick: number;
  sealPoints: number;
  speedPoints: number;
};

export type RunScore = {
  // False for runs recorded before seals were tracked.
  sealsTracked: boolean;
  seals: RunScoreSeal[];
  completion: number;
  base: number;
  multiplier: number;
  total: number;
};
