import { dictionaryWith } from '@helpers/engine/dictionary';
import { gamestate, updateGamestate } from '@helpers/state-game';

export function isSetup(): boolean {
  return gamestate().meta.isSetup;
}

export function setupFinish(): void {
  updateGamestate((state) => {
    state.meta = dictionaryWith(state.meta, 'isSetup', true);
    return state;
  });
}
