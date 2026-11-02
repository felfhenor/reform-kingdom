import { updateGamestate } from '@helpers/state-game';
import type { EdictId } from '@interfaces';

export async function edictsSet(ids: EdictId[]): Promise<void> {
  await updateGamestate((state) => {
    state.edicts = ids;
    return state;
  });
}
