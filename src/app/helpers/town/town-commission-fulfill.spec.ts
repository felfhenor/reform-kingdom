import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/commission/commission-requirement', () => ({
  buildCommissionRequirementEntries: vi.fn(() => []),
  commissionRequirementsSatisfied: vi.fn(),
}));

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  categoryMessageLog: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import {
  buildCommissionRequirementEntries,
  commissionRequirementsSatisfied,
} from '@helpers/commission/commission-requirement';
import { getEntry } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import {
  townCommissionCanFulfill,
  townCommissionReputationReward,
  townCommissionRequirementEntries,
} from '@helpers/town/town-commission-fulfill';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  GameState,
  ItemId,
  RecipeId,
  TownCommissionSlotId,
  TownId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const slotId = 'slot-1' as TownCommissionSlotId;

const offer: CommissionOfferContent = {
  id: 'offer-a' as CommissionOfferId,
  name: 'Commission - Bundle of Wergen Sticks',
  __type: 'commissionoffer',
  description: 'A commission.',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 100, quantityMax: 100 },
  ],
  rewards: [],
  townReputationReward: 25,
  specialtyForRecipeId: 'UNKNOWN' as RecipeId,
};

function withTownState(state: unknown): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { towns: { [townId]: state } },
  } as unknown as GameState);
}

describe('townCommissionRequirementEntries / townCommissionReputationReward', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves requirement entries for an existing slot', () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(buildCommissionRequirementEntries).mockReturnValue([
      {
        kind: 'item',
        content: undefined,
        spritesheet: 'item',
        quantity: 100,
        owned: 0,
      },
    ]);

    expect(townCommissionRequirementEntries(townId, slotId)).toHaveLength(1);
  });

  it('returns an empty list when the slot no longer exists', () => {
    withTownState({ commissionSlots: [] });

    expect(townCommissionRequirementEntries(townId, slotId)).toEqual([]);
  });

  it('resolves the offer reputation reward for an existing slot', () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(getEntry).mockReturnValue(offer);

    expect(townCommissionReputationReward(townId, slotId)).toBe(25);
  });

  it('is 0 when the slot no longer exists', () => {
    withTownState({ commissionSlots: [] });

    expect(townCommissionReputationReward(townId, slotId)).toBe(0);
  });
});

describe('townCommissionCanFulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false when the slot does not exist', () => {
    withTownState({ commissionSlots: [] });

    expect(townCommissionCanFulfill(townId, slotId)).toBe(false);
  });

  it('defers to commissionRequirementsSatisfied for an existing slot', () => {
    withTownState({
      commissionSlots: [
        {
          id: slotId,
          commissionOfferId: offer.id,
          requirements: [],
          generatedAtTick: 0,
        },
      ],
    });
    vi.mocked(commissionRequirementsSatisfied).mockReturnValue(true);

    expect(townCommissionCanFulfill(townId, slotId)).toBe(true);
  });
});
