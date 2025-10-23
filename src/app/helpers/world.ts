import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GameId, GameStateWorld } from '@interfaces';

export function setWorld(world: GameStateWorld): void {
  updateGamestate((gs) => {
    gs.world = world;
    return gs;
  });
}

export function setWorldSeed(seed: string | undefined): void {
  if (!seed) seed = rngUuid();

  updateGamestate((gs) => {
    gs.gameId = seed as GameId;
    return gs;
  });
}

export function worldGameId(): GameId {
  return gamestate().gameId;
}
