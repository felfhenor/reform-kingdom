import { updateTownNode } from '@helpers/town/town-node';
import { townGoldThreshold } from '@helpers/town/town-resource-thresholds';
import type { GameState, TownContent, TownId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function applyTownAccrueHiddenGold(
  state: GameState,
  town: TownContent,
  townId: TownId,
  amount: number,
): void {
  if (amount <= 0) return;

  updateTownNode(state, townId, (target) => {
    target.hiddenGold = clamp(
      target.hiddenGold + amount,
      0,
      townGoldThreshold(town),
    );
  });
}
