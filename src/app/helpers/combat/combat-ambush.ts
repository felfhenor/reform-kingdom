import { jobAbilityEntries } from '@helpers/hero/job-ability';
import { rngSucceedsChance } from '@helpers/rng';

// Each hero with Ambush rolls in party order until one succeeds; that hero springs the single free round.
export function combatRollAmbush(): string | undefined {
  return jobAbilityEntries('Ambush').find(({ value }) =>
    rngSucceedsChance(value),
  )?.character.name;
}
