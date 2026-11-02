import { getEntry } from '@helpers/content/content';
import { edictsState } from '@helpers/state-game';
import type { EdictContent, EdictId } from '@interfaces';
import { uniq } from 'es-toolkit/compat';

// getEntry also resolves names, so require the id itself to match.
function edictEntry(id: EdictId): EdictContent | undefined {
  const entry = getEntry<EdictContent>(id);
  return entry?.__type === 'edict' && entry.id === id ? entry : undefined;
}

export function edictsActive(): EdictContent[] {
  return pruneInvalidEdicts(edictsState()).flatMap((id) => {
    const edict = edictEntry(id);
    return edict ? [edict] : [];
  });
}

export function pruneInvalidEdicts(ids: EdictId[]): EdictId[] {
  return uniq(ids).filter((id) => !!edictEntry(id));
}
