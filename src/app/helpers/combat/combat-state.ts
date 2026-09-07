import { gamestate, updateGamestate } from '@helpers/state-game';
import type { Combat } from '@interfaces';

export function currentCombat(): Combat | undefined {
  return gamestate().world.combat;
}

export function combatReset(): void {
  updateGamestate((state) => {
    state.world.combat = undefined;
    return state;
  });
}
