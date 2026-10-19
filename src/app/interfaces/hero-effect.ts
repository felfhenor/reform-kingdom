import type { DebuffPotency } from '@interfaces/combat';
import type { AffixEffect } from '@interfaces/content-affix';
import type { JobAbilityId } from '@interfaces/content-jobability';
import type { BaseStat } from '@interfaces/stat';

export type HeroEffectStatPerLevel = {
  kind: 'StatPerLevel';
  stat: BaseStat;
  value: number; // added to the job's growth, so it applies retroactively
};

export type HeroEffectJobAbility = {
  kind: 'JobAbility';
  jobAbilityId: JobAbilityId;
  value: number; // the rank's value; the highest grant of an ability wins
};

export type HeroEffectDebuffPotency = DebuffPotency & {
  kind: 'DebuffPotency';
};

// Every effect a hero can carry: gear/teaching affix shapes plus kinds only skill trees grant.
export type HeroEffect =
  | AffixEffect
  | HeroEffectStatPerLevel
  | HeroEffectJobAbility
  | HeroEffectDebuffPotency;
