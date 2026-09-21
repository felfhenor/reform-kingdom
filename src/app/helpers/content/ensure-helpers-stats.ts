import { VALID_GAME_STATS } from '@helpers/content/ensure-helpers-constants';
import { ensureEnumValue } from '@helpers/content/ensure-helpers-core';
import {
  defaultCombatStats,
  defaultMonsterTypeDamageBonus,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import type {
  CombatStatBlock,
  MonsterType,
  SkillStatBonus,
  StatBlock,
  StatusEffectBlock,
} from '@interfaces';

export function ensureStats(
  statblock: Partial<StatBlock> = {},
): Required<StatBlock> {
  return Object.assign({}, defaultStats(), statblock);
}

export function ensureTagResistances(
  resistances: Partial<StatusEffectBlock> = {},
): StatusEffectBlock {
  return Object.assign({}, defaultTagResistances(), resistances);
}

export function ensureCombatStats(
  combatStats: Partial<CombatStatBlock> = {},
): Required<CombatStatBlock> {
  return Object.assign({}, defaultCombatStats(), combatStats);
}

export function ensureMonsterTypeDamage(
  bonus: Partial<Record<MonsterType, number>> = {},
): Record<MonsterType, number> {
  return Object.assign({}, defaultMonsterTypeDamageBonus(), bonus);
}

export function ensureSkillStatBonus(
  bonus: Record<string, unknown> = {},
): SkillStatBonus {
  return {
    skillFamily: (bonus['skillFamily'] as string) ?? 'UNKNOWN',
    stat: ensureEnumValue(bonus['stat'], VALID_GAME_STATS, 'Strength'),
    value: (bonus['value'] as number) ?? 0,
  };
}
