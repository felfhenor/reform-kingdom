import { ONE_YEAR_TICKS } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { applyGlobalEffectRemove } from '@helpers/hero/global-effect-state';
import type {
  GameState,
  GlobalEffect,
  GlobalEffectContent,
  GlobalEffectId,
  TownContent,
  TownId,
} from '@interfaces';

const RAID_DEFENSE_GLOBAL_EFFECT_ID =
  'Raid Defense Requested' as GlobalEffectId;

function raidDefenseGlobalEffect(
  content: GlobalEffectContent,
  townNames: string[],
  currentTick: number,
): GlobalEffect {
  return {
    ...content,
    extendedDescription: townNames.join(', '),
    startTick: currentTick,
    expiresAtTick: currentTick + ONE_YEAR_TICKS,
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
