import {
  ARMORY_CAP,
  ARMORY_ENCUMBERED_THRESHOLD,
  ARMORY_OVERFLOW_MULTIPLIER,
  ONE_YEAR_TICKS,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  applyGlobalEffectAdd,
  applyGlobalEffectRemove,
} from '@helpers/hero/global-effect-state';
import type {
  ArmoryWarningTier,
  GameState,
  GlobalEffectContent,
  GlobalEffectId,
} from '@interfaces';

const ARMORY_WARNING_NAMES: ArmoryWarningTier[] = [
  'Encumbered',
  'Overburdened',
  'Over Capacity',
];

export function armoryCapForBoost(armorySizeBoost: number): number {
  return ARMORY_CAP + armorySizeBoost;
}

export function armoryOverflowCapForBoost(armorySizeBoost: number): number {
  return Math.floor(
    armoryCapForBoost(armorySizeBoost) * ARMORY_OVERFLOW_MULTIPLIER,
  );
}

export function armoryCapForState(state: GameState): number {
  return armoryCapForBoost(state.globalEffectSums.armorySizeBoost);
}

export function armoryOverflowCapForState(state: GameState): number {
  return armoryOverflowCapForBoost(state.globalEffectSums.armorySizeBoost);
}

export function armoryWarningTier(
  armorySize: number,
  cap: number,
): ArmoryWarningTier | undefined {
  const ratio = armorySize / cap;
  if (ratio >= ARMORY_OVERFLOW_MULTIPLIER) return 'Over Capacity';
  if (ratio >= 1) return 'Overburdened';
  if (ratio >= ARMORY_ENCUMBERED_THRESHOLD) return 'Encumbered';
  return undefined;
}

// Call whenever the armory changes (add or remove) - folds into the caller's own state mutation, atomic whether or not that happens inside a tick.
export function syncArmoryGlobalEffects(state: GameState): void {
  const activeTier = armoryWarningTier(
    state.armory.length,
    armoryCapForState(state),
  );

  ARMORY_WARNING_NAMES.forEach((name) => {
    const content = getEntry<GlobalEffectContent>(name as GlobalEffectId);
    if (!content) return;

    const isActive = state.globalEffects.some(
      (effect) => effect.id === content.id,
    );
    const shouldBeActive = name === activeTier;
    if (shouldBeActive === isActive) return;

    if (shouldBeActive) {
      applyGlobalEffectAdd(
        state,
        content.id,
        ONE_YEAR_TICKS,
        timerTicksElapsed(),
      );
    } else {
      applyGlobalEffectRemove(state, content.id);
    }
  });
}
