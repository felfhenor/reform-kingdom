import {
  jobAbilityEntries,
  jobAbilityEntriesFor,
} from '@helpers/hero/job-ability';
import { rngSucceedsChance } from '@helpers/rng';
import type { Character, Combat } from '@interfaces';

// Each hero with Ambush rolls in party order until one succeeds; that hero springs the single free round.
export function combatRollAmbush(party?: Character[]): string | undefined {
  const entries = party
    ? jobAbilityEntriesFor(party, 'Ambush')
    : jobAbilityEntries('Ambush');
  return entries.find(({ value }) => rngSucceedsChance(value))?.character.name;
}

// Only the ambush round goes uncounted; a round after it holds a queue until it ends. An empty fight was never fought.
export function combatWonInAmbushRound(combat: Combat): boolean {
  return (
    combat.guardians.length > 0 &&
    combat.rounds === 0 &&
    (!!combat.ambushedBy || !combat.turnQueue)
  );
}
