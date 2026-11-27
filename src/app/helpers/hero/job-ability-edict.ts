import { jobAbilityValue } from '@helpers/hero/job-ability';
import { globalEffectSumsState } from '@helpers/state-game';
import { isWorldNodeTypeRemoved } from '@helpers/world-node/world-nodes';

// Without gathering nodes, Fortunate Finds doubles monster gather drops instead.
export function jobAbilityGatherLuckOnMonsters(): boolean {
  return isWorldNodeTypeRemoved('GatherNode');
}

// Without shrines, Sanctified Incantations extends astral spells instead.
export function jobAbilityShrineBoostToAstral(): boolean {
  return isWorldNodeTypeRemoved('Shrine');
}

// Permanent shrine buffs can't last longer, so Sanctified Incantations strengthens them instead.
export function jobAbilityShrineBoostToStrength(): boolean {
  return globalEffectSumsState().shrineBuffsPermanent;
}

export function jobAbilityShrineBoostAstralDuration(): number {
  return jobAbilityShrineBoostToAstral()
    ? jobAbilityValue('ShrineDurationBoost')
    : 0;
}

export function jobAbilityShrineBoostStrength(): number {
  return jobAbilityShrineBoostToStrength()
    ? jobAbilityValue('ShrineDurationBoost')
    : 0;
}
