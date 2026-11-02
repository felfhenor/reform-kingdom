import { getEntriesByType, getEntry } from '@helpers/content/content';
import { edictsState } from '@helpers/state-game';
import type { EdictContent, EdictId, EdictKind } from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

const EDICT_KIND_ORDER: EdictKind[] = [
  'PartySize',
  'Challenge',
  'Variant',
  'Boon',
  'SeatBoon',
];

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

// Seat boons come from the party size, so they're never picked directly.
export function edictsPickable(): EdictContent[] {
  const pickable = getEntriesByType<EdictContent>('edict').filter(
    (edict) => !!edict.enabled && edict.kind !== 'SeatBoon',
  );
  return sortBy(pickable, [
    (edict) => EDICT_KIND_ORDER.indexOf(edict.kind),
    (edict) => edict.name,
  ]);
}

export function edictIsBlocked(
  edict: EdictContent,
  picked: EdictContent[],
): boolean {
  if (!edict.group) return false;
  return picked.some(
    (other) => other.id !== edict.id && other.group === edict.group,
  );
}

export function edictsSanitized(ids: EdictId[]): EdictId[] {
  const pickable = edictsPickable();
  const kept: EdictContent[] = [];

  uniq(ids).forEach((id) => {
    const edict = pickable.find((entry) => entry.id === id);
    if (edict && !edictIsBlocked(edict, kept)) kept.push(edict);
  });

  return kept.map((edict) => edict.id);
}
