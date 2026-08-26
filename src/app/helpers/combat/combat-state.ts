import { gamestate, updateGamestate } from '@helpers/state-game';
import type { Combat } from '@interfaces';

// Split out from combat.ts so low-level modules (e.g. hero/travel.ts) can read/clear
// combat state without importing combat.ts, which would create an import cycle through
// combat-end.ts (combat.ts -> combat-end.ts -> hero/travel.ts).
export function currentCombat(): Combat | undefined {
  return gamestate().world.combat;
}

export function combatReset(): void {
  updateGamestate((state) => {
    state.world.combat = undefined;
    return state;
  });
}
