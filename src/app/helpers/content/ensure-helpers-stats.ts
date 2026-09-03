import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import type {
  CombatStatBlock,
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
