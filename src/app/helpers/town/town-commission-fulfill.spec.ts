import { describe, expect, it } from 'vitest';

import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureItem } from '@helpers/content/ensure-item';
import { applyMaterialDelta } from '@helpers/item/materials';
import {
  townCommissionCanFulfill,
  townCommissionReputationReward,
  townCommissionRequirementEntries,
} from '@helpers/town/town-commission-fulfill';
import type {
  CommissionOfferId,
  GameState,
  ItemId,
  TownCommissionSlotId,
  TownId,
} from '@interfaces';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const slotId = 'slot-1' as TownCommissionSlotId;
const stick = ensureItem({
  id: 'wergen-stick' as ItemId,
  name: 'Wergen Stick',
});
const offer = ensureCommissionOffer({
  id: 'offer-a' as CommissionOfferId,
  name: 'Bundle of Wergen Sticks',
  townReputationReward: 25,
});

function seedSlot(edit?: (state: GameState) => void): GameState {
  seedContent([stick, offer]);
  return seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [{ itemId: stick.id, quantity: 100 }],
          generatedAtTick: 0,
        },
      ],
    });
    edit?.(state);
  });
}

const missing = 'gone' as TownCommissionSlotId;

describe('townCommissionRequirementEntries', () => {
  it('lists a slot’s requirements against what the player owns', () => {
    seedSlot((state) => applyMaterialDelta(state, stick.id, 40));

    expect(townCommissionRequirementEntries(townId, slotId)).toEqual([
      expect.objectContaining({ content: stick, quantity: 100, owned: 40 }),
    ]);
    expect(townCommissionRequirementEntries(townId, missing)).toEqual([]);
  });
});

describe('townCommissionReputationReward', () => {
  it('pays the slot’s offer reward, nothing for a missing slot or offer', () => {
    seedSlot();

    expect(townCommissionReputationReward(townId, slotId)).toBe(25);
    expect(townCommissionReputationReward(townId, missing)).toBe(0);

    seedContent([stick]);
    expect(townCommissionReputationReward(townId, slotId)).toBe(0);
  });

  it('scales the reward by the town’s reputation tier', () => {
    seedSlot(
      (state) =>
        (state.world.towns[townId].reputation = TOWN_REPUTATION_THRESHOLDS[1]),
    );
    seedContent([
      stick,
      ensureCommissionOffer({
        ...offer,
        reputationTierMultipliers: [
          { tier: 0, value: 1 },
          { tier: 1, value: 2 },
        ],
      }),
    ]);

    expect(townCommissionReputationReward(townId, slotId)).toBe(50);
  });
});

describe('townCommissionCanFulfill', () => {
  it('needs every requirement covered, against live or given state', () => {
    seedSlot((state) => applyMaterialDelta(state, stick.id, 99));
    expect(townCommissionCanFulfill(townId, slotId)).toBe(false);

    const covered = seedSlot((state) =>
      applyMaterialDelta(state, stick.id, 100),
    );
    expect(townCommissionCanFulfill(townId, slotId)).toBe(true);
    expect(townCommissionCanFulfill(townId, missing)).toBe(false);

    seedGamestate();
    expect(townCommissionCanFulfill(townId, slotId, covered)).toBe(true);
  });
});
