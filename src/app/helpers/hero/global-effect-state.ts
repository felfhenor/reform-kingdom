import { getEntry } from '@helpers/content/content';
import {
  CombatStatDimension,
  StatusEffectTagDimension,
  type GameState,
  type GlobalEffectContent,
  type GlobalEffectEffect,
  type GlobalEffectId,
} from '@interfaces';

// Split out of global-effects.ts so town-reputation-buff.ts can depend on these leaf
// pieces without creating a cycle back into global-effects.ts.

// Renders a set of effects as short "Label: +N[%]" fragments, comma-joined - for
// appending live numbers onto a buff's tooltip description (e.g. town reputation buffs).
export function globalEffectEffectsDescription(
  effects: GlobalEffectEffect[],
): string {
  return effects
    .map((effect) => {
      switch (effect.effectType) {
        case 'GainStats':
          return `${effect.stat}: +${effect.value}`;
        case 'GainCombatStat': {
          const isPercent =
            CombatStatDimension.isPercent?.[effect.combatStat] ?? true;
          return `${CombatStatDimension.label[effect.combatStat]}: +${effect.value}${isPercent ? '%' : ''}`;
        }
        case 'GlobalXPGainMultiplier':
          return `XP Gain: +${effect.value * 100}%`;
        case 'DebuffResistance':
          return `All Debuff Resist: +${effect.value}%`;
        case 'DebuffResistanceTag':
          return `${StatusEffectTagDimension.label[effect.tag]}: +${effect.value}%`;
      }
    })
    .join(', ');
}

// Direct-state mutators for callers folding this into a larger `updateGamestate` commit - mirrors `applyMaterialDelta` in `materials.ts`.
export function applyGlobalEffectAdd(
  state: GameState,
  globalEffectId: GlobalEffectId,
  durationTicks: number,
  currentTick: number,
): void {
  const content = getEntry<GlobalEffectContent>(globalEffectId);
  if (!content) return;

  state.globalEffects.push({
    ...content,
    startTick: currentTick,
    expiresAtTick: currentTick + durationTicks,
  });
}

export function applyGlobalEffectRemove(
  state: GameState,
  id: GlobalEffectId,
): void {
  state.globalEffects = state.globalEffects.filter(
    (effect) => effect.id !== id,
  );
}
