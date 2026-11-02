import {
  EDICT_FRAGMENT_MULTIPLIER_STEP,
  EDICT_SCORE_MULTIPLIER_FLOOR,
} from '@helpers/config';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { edictsActive, edictsSanitized } from '@helpers/edict/edict';
import { updateGamestate } from '@helpers/state-game';
import type { EdictContent, EdictId, EdictKind } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';

const EDICT_KIND_LABELS: Record<EdictKind, string> = {
  PartySize: 'Party size',
  Challenge: 'Challenge',
  Variant: 'Variant',
  Boon: 'Boon',
  SeatBoon: 'Seat boon',
};

const EDICT_KIND_GROUP_LABELS: Record<EdictKind, string> = {
  PartySize: 'Party size',
  Challenge: 'Challenges',
  Variant: 'Variants',
  Boon: 'Boons',
  SeatBoon: 'Seat boons',
};

export async function edictsSet(ids: EdictId[]): Promise<void> {
  const sanitized = edictsSanitized(ids);
  await updateGamestate((state) => {
    state.edicts = sanitized;
    return state;
  });
}

// Sent once the run has started, so debug edict changes and failed starts aren't counted as runs.
export function edictsTrackRun(): void {
  const edicts = edictsActive();
  edicts.forEach((edict) => {
    analyticsSendDesignEvent('Edict:Pick');
    analyticsSendDesignEvent(`Edict:Pick:${analyticsSafeSegment(edict.name)}`);
  });
  analyticsSendDesignEvent(`Edict:Run:Count:${edicts.length}`);
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

export function edictShortName(edict: EdictContent): string {
  return edict.name.replace(/^Edict of (the )?/, '');
}

export function edictKindLabel(kind: EdictKind): string {
  return EDICT_KIND_LABELS[kind];
}

export function edictKindGroupLabel(kind: EdictKind): string {
  return EDICT_KIND_GROUP_LABELS[kind];
}
