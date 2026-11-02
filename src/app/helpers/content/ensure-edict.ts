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
    group: edict.group ?? '',
  };
}
