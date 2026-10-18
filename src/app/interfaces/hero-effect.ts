import type { AffixEffect } from '@interfaces/content-affix';
import type { BaseStat } from '@interfaces/stat';

export type HeroEffectStatPerLevel = {
  kind: 'StatPerLevel';
  stat: BaseStat;
  value: number; // added to the job's growth, so it applies retroactively
};

// Every effect a hero can carry: gear/teaching affix shapes plus kinds only skill trees grant.
export type HeroEffect = AffixEffect | HeroEffectStatPerLevel;
