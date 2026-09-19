import { updateGamestate } from '@helpers/state-game';

export function combatReset(): void {
  updateGamestate((state) => {
    state.world.combat = undefined;
    return state;
  });
}
