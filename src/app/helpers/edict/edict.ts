import {
  EDICT_FRAGMENT_MULTIPLIER_STEP,
  EDICT_SCORE_MULTIPLIER_FLOOR,
  PARTY_SIZE_MAX,
} from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { applyMaterialDelta } from '@helpers/item/materials';
import { edictsState } from '@helpers/state-game';
import type {
  EdictContent,
  EdictId,
  EdictKind,
  GameState,
  SeatBoonContent,
} from '@interfaces';
import { intersection, sortBy, sumBy, uniq } from 'es-toolkit/compat';

const EDICT_KIND_ORDER: EdictKind[] = [
  'PartySize',
  'Challenge',
  'Variant',
  'Boon',
];

// getEntry also resolves names, so require the id itself to match.
export function edictEntry(id: EdictId): EdictContent | undefined {
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

export function edictsPickable(): EdictContent[] {
  return sortBy(getEntriesByType<EdictContent>('edict'), [
    (edict) => EDICT_KIND_ORDER.indexOf(edict.kind),
    (edict) => edict.name,
  ]);
}

export function edictSeatBoons(edict: EdictContent): SeatBoonContent[] {
  return (edict.seatBoonIds ?? []).flatMap((id) => {
    const seatBoon = getEntry<SeatBoonContent>(id);
    return seatBoon?.__type === 'seatboon' && seatBoon.id === id
      ? [seatBoon]
      : [];
  });
}

export function edictsPartySize(edicts: EdictContent[]): number {
  return Math.min(
    PARTY_SIZE_MAX,
    ...edicts.map((edict) => edict.partySize ?? PARTY_SIZE_MAX),
  );
}

export function edictIsBlocked(
  edict: EdictContent,
  picked: EdictContent[],
): boolean {
  return picked.some(
    (other) =>
      other.id !== edict.id &&
      intersection(other.groups, edict.groups).length > 0,
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

export function edictsFragmentTotal(edicts: EdictContent[]): number {
  return sumBy(edicts, (edict) => edict.fragments);
}

export function edictScoreMultiplier(fragments: number): number {
  return Math.max(
    EDICT_SCORE_MULTIPLIER_FLOOR,
    1 + EDICT_FRAGMENT_MULTIPLIER_STEP * fragments,
  );
}

// Granted once, when the run's world is created, like the starting gold.
export function applyEdictStartingItems(state: GameState): void {
  state.edicts
    .flatMap((id) => edictEntry(id)?.startingItems ?? [])
    .forEach(({ itemId, quantity }) =>
      applyMaterialDelta(state, itemId, quantity),
    );
}
