import { getEntry } from '@helpers/content/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import {
  raidAssaulterPreview,
  raidDefenderPreview,
  telegraphedRaidTownIds,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import { isPartyAtTown } from '@helpers/town/town-visit';
import type { RaidDefenseRowViewModel, TownContent } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// One row per telegraphed raid, soonest engageWindowExpiresAtTick first - drives the Requested Defenses modal.
export function raidDefenseRowViewModels(): RaidDefenseRowViewModel[] {
  const now = timerTicksElapsed();
  const canTravel = canPartyTravel();

  const rows = telegraphedRaidTownIds()
    .map((townId) => getEntry<TownContent>(townId))
    .filter((town): town is TownContent => !!town)
    .map((town) => {
      const telegraph = townRaidTelegraph(town.id);
      if (!telegraph) return undefined;

      const ticksUntilResolve = telegraph.engageWindowExpiresAtTick - now;

      const row: RaidDefenseRowViewModel = {
        townId: town.id,
        townName: town.name,
        nodeName: town.name,
        ticksUntilResolve,
        remainingLabel: formatDuration(ticksUntilResolve),
        assaulters: raidAssaulterPreview(town),
        defenders: raidDefenderPreview(town),
        isPartyHere: isPartyAtTown(town.id),
        canTravel,
        travelEtaSeconds: travelEtaSecondsTo(town.name),
      };
      return row;
    })
    .filter((row): row is RaidDefenseRowViewModel => !!row);

  return sortBy(rows, (row) => row.ticksUntilResolve);
}
