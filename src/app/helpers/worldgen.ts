import { gamestate } from '@helpers/state-game';
import type { GameStateWorld } from '@interfaces';

export async function worldgenGenerateWorld(): Promise<
  GameStateWorld & { didFinish?: boolean }
> {
  return {
    ...gamestate().world,
    didFinish: true,
  };
}
