import { getEntriesByType, getEntry } from '@helpers/content/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { applyGlobalEffectRemove } from '@helpers/hero/global-effect-state';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import {
  raidAssaulterPreview,
  raidDefenderPreview,
  telegraphedRaidTownIds,
  townRaidTelegraph,
} from '@helpers/town/raid/town-raid-state';
import { isPartyAtTown } from '@helpers/town/town-visit';
import type {
  GameState,
  GlobalEffect,
  GlobalEffectContent,
  GlobalEffectId,
  RaidDefenseRowViewModel,
  TownContent,
  TownId,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Mirrors REGIONAL_BUFF_DURATION_TICKS
const RAID_DEFENSE_EFFECT_DURATION_TICKS = 60 * 60 * 24 * 365 * 100;
const RAID_DEFENSE_GLOBAL_EFFECT_ID =
  'Raid Defense Requested' as GlobalEffectId;

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

function raidDefenseGlobalEffect(
  content: GlobalEffectContent,
  townNames: string[],
  currentTick: number,
): GlobalEffect {
  return {
    ...content,
    extendedDescription: townNames.join(', '),
    startTick: currentTick,
    expiresAtTick: currentTick + RAID_DEFENSE_EFFECT_DURATION_TICKS,
  };
}

function telegraphedRaidTownIdsFromState(state: GameState): TownId[] {
  return getEntriesByType<TownContent>('town')
    .filter((town) => {
      const townState = state.world.towns[town.id];
      return (
        townState?.raidTelegraphedAtTick !== undefined &&
        townState.raidEngageWindowExpiresAtTick !== undefined
      );
    })
    .map((town) => town.id);
}

export function raidDefenseGlobalEffectApply(
  state: GameState,
  currentTick: number,
): void {
  const content = getEntry<GlobalEffectContent>(RAID_DEFENSE_GLOBAL_EFFECT_ID);
  if (!content) return;

  applyGlobalEffectRemove(state, content.id);

  const townNames = telegraphedRaidTownIdsFromState(state)
    .map((townId) => getEntry<TownContent>(townId)?.name)
    .filter((name): name is string => !!name);
  if (townNames.length === 0) return;

  state.globalEffects.push(
    raidDefenseGlobalEffect(content, townNames, currentTick),
  );
}
