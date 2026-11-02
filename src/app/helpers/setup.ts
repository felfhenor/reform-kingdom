import { gamestate, updateGamestate } from '@helpers/state-game';

export function isSetup(): boolean {
  return gamestate().meta.isSetup;
}

export function setupFinish(): Promise<void> {
  return updateGamestate((state) => {
    state.meta.isSetup = true;
    // Reset stamps createdAt when the state is built, which can be long before the run starts.
    state.meta.createdAt = Date.now();
    return state;
  });
}
