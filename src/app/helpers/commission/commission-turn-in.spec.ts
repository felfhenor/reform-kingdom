import { describe, expect, it } from 'vitest';

import {
  grantCommissionRewards,
  spendCommissionRequirements,
} from '@helpers/commission/commission-turn-in';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { defaultGameState } from '@helpers/defaults';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CommissionOfferId,
  EquipmentId,
  GameState,
  ItemId,
  MonsterId,
} from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';

const stick = 'wergen-stick' as ItemId;
const sword = 'sword' as EquipmentId;
const token = 'trader-token' as ItemId;

function stateWith(edit: (state: GameState) => void): GameState {
  const state = defaultGameState();
  edit(state);
  return state;
}

describe('spendCommissionRequirements', () => {
  it('spends materials and consumes matching armory gear, leaving the rest', () => {
    const other = buildEquipmentItem('other' as EquipmentId);
    const state = stateWith((draft) => {
      applyMaterialDelta(draft, stick, 150);
      draft.armory = [
        buildEquipmentItem(sword),
        other,
        buildEquipmentItem(sword),
      ];
    });

    spendCommissionRequirements(state, [
      { itemId: stick, quantity: 100 },
      { equipmentId: sword, quantity: 2 },
    ]);

    expect(state.materials[stick]?.quantity).toBe(50);
    expect(state.armory).toEqual([other]);
  });

  it('spends nothing for a monster-kill requirement', () => {
    const state = stateWith((draft) => applyMaterialDelta(draft, stick, 5));
    const before = structuredClone(state);

    spendCommissionRequirements(state, [
      { monsterId: 'sand-worm' as MonsterId, quantity: 5, progress: 5 },
    ]);

    expect(state).toEqual(before);
  });
});

describe('grantCommissionRewards', () => {
  it('rolls the offer’s rewards, adds them to the state and returns them', () => {
    const offer = ensureCommissionOffer({
      id: 'offer-a' as CommissionOfferId,
      rewards: [
        // Scales with level, so the quantity shows rewards roll at level 1.
        ensureDroppedReward({
          itemId: token,
          chance: 100,
          min: 2,
          max: 2,
          bonusPerLevel: 1,
        }),
        ensureDroppedReward({ itemId: stick, chance: 0, min: 9, max: 9 }),
      ],
    });
    const state = defaultGameState();

    const drops = grantCommissionRewards(state, offer);

    expect(drops).toEqual([{ kind: 'Item', itemId: token, quantity: 3 }]);
    expect(state.materials[token]?.quantity).toBe(3);
    expect(state.materials[stick]).toBeUndefined();
  });
});
