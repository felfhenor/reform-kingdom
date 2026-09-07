import { gamestate } from '@helpers/state-game';
import { isTownCraftDebuffActive } from '@helpers/town/raid/town-raid-state';
import type { TownId } from '@interfaces';

// Undefined once the raid-loss craft debuff has expired (or never applied) - lets callers format their own countdown.
export function townCraftDebuffExpiresAtTick(
  townId: TownId,
): number | undefined {
  const state = gamestate().world.towns[townId];
  if (!state || !isTownCraftDebuffActive(state)) return undefined;

  return state.craftSpeedDebuffExpiresAtTick;
}
