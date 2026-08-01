import { updateGamestate } from '@helpers/state-game';
import type { GameStateWorld } from '@interfaces';

export function setWorld(world: GameStateWorld): void {
  updateGamestate((gs) => {
    gs.world = world;
    return gs;
  });
}
