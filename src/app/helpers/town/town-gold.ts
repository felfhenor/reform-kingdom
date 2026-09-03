import type { GameState, TownContent, TownId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function applyTownAccrueHiddenGold(
  state: GameState,
  town: TownContent,
  townId: TownId,
  amount: number,
): void {
  const target = state.world.towns[townId];
  if (!target || amount <= 0) return;

  target.hiddenGold = clamp(
    target.hiddenGold + amount,
    0,
    town.gathering.goldRequiredBeforeCutoff,
  );
}
