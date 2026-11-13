import { ensureGlobalEffectEffect } from '@helpers/content/ensure-globaleffect';
import {
  ensureArray,
  ensureItemQuantity,
} from '@helpers/content/ensure-helpers-core';
import { PARTY_SIZE_MAX } from '@helpers/config';
import type { EdictContent, EdictId } from '@interfaces';

export function ensureEdict(
  edict: Partial<EdictContent>,
): Required<EdictContent> {
  return {
    id: edict.id ?? ('UNKNOWN' as EdictId),
    name: edict.name ?? 'UNKNOWN',
    __type: 'edict',
    description: edict.description ?? 'UNKNOWN',
    sprite: edict.sprite ?? '',
    kind: edict.kind ?? 'Challenge',
    fragments: edict.fragments ?? 0,
    groups: edict.groups ?? [],
    effects: ensureArray(edict.effects, ensureGlobalEffectEffect),
    startingItems: ensureArray(edict.startingItems, ensureItemQuantity),
    partySize: edict.partySize ?? PARTY_SIZE_MAX,
    seatBoonIds: edict.seatBoonIds ?? [],
  };
}
