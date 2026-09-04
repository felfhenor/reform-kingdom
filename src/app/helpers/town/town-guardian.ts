import { getEntriesByType } from '@helpers/content/content';
import { townReputationTier } from '@helpers/town/reputation/town-reputation';
import type {
  MonsterId,
  TownContent,
  TownDefenseGuardianEntry,
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// Every monster referenced anywhere in any town's guardian tiers - these are
// combat allies, not discoverable monsters, so the bestiary excludes them.
export function townGuardianMonsterIds(): MonsterId[] {
  const towns = getEntriesByType<TownContent>('town');

  return uniq(
    towns.flatMap((town) =>
      town.defense.guardian.reputationTiers.flatMap((tier) =>
        tier.guardians.map((guardian) => guardian.monsterId),
      ),
    ),
  );
}

// Exact-match on the town's current reputation tier, same convention as
// `townReputationBuffSync`'s tier lookup - unauthored tiers resolve to no guardians.
export function townGuardiansForCurrentReputation(
  town: TownContent,
): TownDefenseGuardianEntry[] {
  const tier = townReputationTier(town.id);
  return (
    town.defense.guardian.reputationTiers.find((t) => t.tier === tier)
      ?.guardians ?? []
  );
}
