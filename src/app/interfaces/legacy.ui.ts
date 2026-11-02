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
