import { exploreDifficultyTier } from '@helpers/engine/difficulty-tier';
import { partyMinLevel } from '@helpers/item/gathering';
import { worldTownsState } from '@helpers/state-game';
import { isTownCraftDebuffActive } from '@helpers/town/raid/town-raid-state';
import type {
  TownContent,
  TownId,
  TownRaidCombatantRow,
  TownRaidThreat,
} from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

// Undefined once the raid-loss craft debuff has expired (or never applied) - lets callers format their own countdown.
export function townCraftDebuffExpiresAtTick(
  townId: TownId,
): number | undefined {
  const state = worldTownsState()[townId];
  if (!state || !isTownCraftDebuffActive(state)) return undefined;

  return state.craftSpeedDebuffExpiresAtTick;
}

export function raidCombatantCount(rows: TownRaidCombatantRow[]): number {
  return sumBy(rows, (row) => row.quantity);
}

// Raid combat always runs at the assaulter range's max, so the min would undersell it.
export function raidThreat(town: TownContent): TownRaidThreat {
  const level = town.defense.assaulter.level.max;

  return {
    level,
    difficulty: exploreDifficultyTier(
      { min: level, max: level },
      partyMinLevel(),
    ),
  };
}
