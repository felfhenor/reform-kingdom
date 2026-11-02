import { updateGamestate } from '@helpers/state-game';
import type { EdictId } from '@interfaces';

export function edictsSet(ids: EdictId[]): void {
  updateGamestate((state) => {
    state.edicts = ids;
    return state;
  });
}
