import { VALID_GAME_STATS } from '@helpers/content/ensure-helpers-constants';
import type {
  EdictContent,
  EdictEffect,
  EdictId,
  EdictStatTarget,
  GameStat,
} from '@interfaces';

const VALID_EDICT_STAT_TARGETS: EdictStatTarget[] = ['Hero', 'Enemy'];

// An unknown target or stat drops the effect, so a typo can't move it onto the wrong thing.
export function ensureEdictEffect(
  effect: Partial<EdictEffect> = {},
): EdictEffect | undefined {
  const target = effect.target as EdictStatTarget;
  const stat = effect.stat as GameStat | undefined;
  if (!VALID_EDICT_STAT_TARGETS.includes(target)) return undefined;
  if (stat !== undefined && !VALID_GAME_STATS.includes(stat)) return undefined;

  return {
    effectType: 'StatPercent',
    target,
    percent: effect.percent ?? 0,
    ...(stat === undefined ? {} : { stat }),
  };
}

export function ensureEdict(
  edict: Partial<EdictContent>,
): Required<EdictContent> {
  const effects = Array.isArray(edict.effects) ? edict.effects : [];

  return {
    id: edict.id ?? ('UNKNOWN' as EdictId),
    name: edict.name ?? 'UNKNOWN',
    __type: 'edict',
    description: edict.description ?? 'UNKNOWN',
    sprite: edict.sprite ?? '',
    kind: edict.kind ?? 'Challenge',
    fragments: edict.fragments ?? 0,
    group: edict.group ?? '',
    enabled: edict.enabled ?? false,
    effects: effects.flatMap((effect) => {
      const ensured = ensureEdictEffect(effect ?? {});
      return ensured ? [ensured] : [];
    }),
  };
}
