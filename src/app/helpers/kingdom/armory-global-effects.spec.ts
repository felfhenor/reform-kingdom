import { beforeEach, describe, expect, it } from 'vitest';

import {
  ARMORY_CAP,
  ARMORY_ENCUMBERED_THRESHOLD,
  ARMORY_OVERFLOW_MULTIPLIER,
} from '@helpers/config';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { defaultGameState } from '@helpers/defaults';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import {
  armoryCapForBoost,
  syncArmoryGlobalEffects,
} from '@helpers/kingdom/armory-global-effects';
import type { EquipmentId, GameState, GlobalEffectId } from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';

// Looked up by name, so each stored id differs from it on purpose.
const tier = (name: string) =>
  ensureGlobalEffect({ id: `${name}-id` as GlobalEffectId, name });
const encumbered = tier('Encumbered');
const overburdened = tier('Overburdened');
const overCapacity = tier('Over Capacity');

// Smallest armory size at or above `ratio` of the cap.
const sizeAt = (ratio: number, boost = 0) =>
  Math.ceil(armoryCapForBoost(boost) * ratio);

function stateWith(
  armorySize: number,
  active: GlobalEffectId[] = [],
  armorySizeBoost = 0,
): GameState {
  const state = defaultGameState();
  state.armory = Array.from({ length: armorySize }, () =>
    buildEquipmentItem('gear' as EquipmentId),
  );
  state.globalEffectSums.armorySizeBoost = armorySizeBoost;
  active.forEach((id) => applyGlobalEffectAdd(state, id, 1000, 0));
  return state;
}

function syncedTiers(state: GameState): GlobalEffectId[] {
  syncArmoryGlobalEffects(state);
  return state.globalEffects.map((effect) => effect.id);
}

beforeEach(() => {
  seedContent([encumbered, overburdened, overCapacity]);
});

describe('syncArmoryGlobalEffects', () => {
  it('shows the tier for how full the armory is, from each threshold up', () => {
    expect(
      syncedTiers(stateWith(sizeAt(ARMORY_ENCUMBERED_THRESHOLD) - 1)),
    ).toEqual([]);
    expect(syncedTiers(stateWith(sizeAt(ARMORY_ENCUMBERED_THRESHOLD)))).toEqual(
      [encumbered.id],
    );
    expect(syncedTiers(stateWith(ARMORY_CAP - 1))).toEqual([encumbered.id]);
    expect(syncedTiers(stateWith(ARMORY_CAP))).toEqual([overburdened.id]);
    expect(syncedTiers(stateWith(sizeAt(ARMORY_OVERFLOW_MULTIPLIER)))).toEqual([
      overCapacity.id,
    ]);
  });

  it('keeps an already-shown tier, swaps a stale one, and clears once back under', () => {
    expect(syncedTiers(stateWith(ARMORY_CAP, [overburdened.id]))).toEqual([
      overburdened.id,
    ]);
    expect(
      syncedTiers(
        stateWith(sizeAt(ARMORY_OVERFLOW_MULTIPLIER), [overburdened.id]),
      ),
    ).toEqual([overCapacity.id]);
    expect(syncedTiers(stateWith(1, [encumbered.id]))).toEqual([]);
  });

  it('switches tier at exactly each threshold', () => {
    // A cap boost where the threshold lands on a whole item count.
    const exactly = (ratio: number) => {
      const boost = Array.from({ length: 100 }, (_, i) => i).find((b) =>
        Number.isInteger(armoryCapForBoost(b) * ratio),
      )!;
      return stateWith(armoryCapForBoost(boost) * ratio, [], boost);
    };

    expect(syncedTiers(exactly(ARMORY_ENCUMBERED_THRESHOLD))).toEqual([
      encumbered.id,
    ]);
    expect(syncedTiers(exactly(ARMORY_OVERFLOW_MULTIPLIER))).toEqual([
      overCapacity.id,
    ]);
  });

  it('measures fullness against a boosted cap', () => {
    const size = sizeAt(ARMORY_ENCUMBERED_THRESHOLD);
    const boost = ARMORY_CAP;

    expect(syncedTiers(stateWith(size, [], boost))).toEqual([]);
    expect(syncedTiers(stateWith(armoryCapForBoost(boost), [], boost))).toEqual(
      [overburdened.id],
    );
  });

  it('skips a tier with no content', () => {
    seedContent([encumbered, overCapacity]);

    expect(syncedTiers(stateWith(ARMORY_CAP))).toEqual([]);
  });
});
