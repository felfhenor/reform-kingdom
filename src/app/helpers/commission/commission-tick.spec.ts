import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/commission/commission-reset', () => ({
  mostRecentCommissionResetAt: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngChoiceWeighted: vi.fn(),
  rngNumberRange: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(),
  worldNodesOfType: vi.fn(),
}));

import { mostRecentCommissionResetAt } from '@helpers/commission/commission-reset';
import {
  commissionGenerateIfMissing,
  commissionProcessTick,
  hasAnyCommission,
  pruneInvalidCommissions,
} from '@helpers/commission/commission-tick';
import { getEntry } from '@helpers/content';
import { rngChoiceWeighted, rngNumberRange } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  worldNodeCaravan,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CommissionOfferContent,
  CommissionOfferId,
  GameState,
  GameStateCommissions,
  ItemId,
  WorldNodeEntry,
} from '@interfaces';

const entry = { nodeName: 'Duchy Trading Caravan - Carrina' } as WorldNodeEntry;
const caravan: CaravanContent = {
  id: 'carrina-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Carrina',
  __type: 'caravan',
  description: 'A caravan.',
  traderResetTime: 100,
  level: { min: 1, max: 10 },
  markupPercentages: { sell: 25, buy: -15 },
  traderCategories: ['Carrina'],
  commissionOffers: [
    { commissionOfferId: 'offer-a' as CommissionOfferId, weight: 1 },
  ],
};

const offer: CommissionOfferContent = {
  id: 'offer-a' as CommissionOfferId,
  name: 'Commission - Wergen Sticks',
  __type: 'commissionoffer',
  description: 'A commission.',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 100, quantityMax: 100 },
  ],
  tokenReward: 1,
};

function withCommissionState(commissions: Record<string, unknown>): void {
  vi.mocked(gamestate).mockReturnValue({
    world: { commissions },
  } as unknown as GameState);
}

describe('commissionProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(worldNodesOfType).mockReturnValue([entry]);
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);
    vi.mocked(mostRecentCommissionResetAt).mockReturnValue(5000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not regenerate when the current commission was generated after the boundary', () => {
    withCommissionState({
      [caravan.id]: {
        generatedAt: 6000,
        commissionOfferId: offer.id,
        completed: false,
      },
    });

    commissionProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('regenerates on the first tick when no state exists yet', () => {
    withCommissionState({});
    vi.mocked(getEntry).mockReturnValue(offer);
    vi.mocked(rngChoiceWeighted).mockReturnValue({ offer, weight: 1 });
    vi.mocked(rngNumberRange).mockReturnValue(100);
    vi.spyOn(Date, 'now').mockReturnValue(9000);

    commissionProcessTick();

    expect(updateGamestate).toHaveBeenCalledTimes(1);
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { commissions: {} },
    } as unknown as GameState);

    expect(result.world.commissions[caravan.id]).toEqual({
      commissionOfferId: offer.id,
      requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
      completed: false,
      generatedAt: 9000,
    });
  });

  it('regenerates once the last commission is older than the reset boundary', () => {
    withCommissionState({
      [caravan.id]: {
        generatedAt: 4000,
        commissionOfferId: offer.id,
        completed: true,
      },
    });
    vi.mocked(getEntry).mockReturnValue(offer);
    vi.mocked(rngChoiceWeighted).mockReturnValue({ offer, weight: 1 });
    vi.mocked(rngNumberRange).mockReturnValue(100);

    commissionProcessTick();

    expect(updateGamestate).toHaveBeenCalledTimes(1);
  });

  it('leaves state untouched when no offer is eligible, so it retries next tick', () => {
    withCommissionState({});
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);

    commissionProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('hasAnyCommission', () => {
  it('is false when no caravan has generated a commission yet', () => {
    withCommissionState({});

    expect(hasAnyCommission()).toBe(false);
  });

  it('is true once at least one commission exists', () => {
    withCommissionState({
      [caravan.id]: { generatedAt: 1000, commissionOfferId: offer.id, completed: false },
    });

    expect(hasAnyCommission()).toBe(true);
  });
});

describe('pruneInvalidCommissions', () => {
  // Resolves by id so caravan-key and commissionOfferId validation can be asserted independently.
  function mockContentLookup(...content: { id: string }[]): void {
    vi.mocked(getEntry).mockImplementation((id: string) =>
      content.find((c) => c.id === id) as never,
    );
  }

  it('keeps a commission whose caravan key and commissionOfferId both resolve to real content', () => {
    mockContentLookup(caravan, offer);
    const commissions: GameStateCommissions = {
      [caravan.id]: {
        commissionOfferId: offer.id,
        requirements: [],
        completed: false,
        generatedAt: 1000,
      },
    };

    expect(pruneInvalidCommissions(commissions)).toEqual(commissions);
  });

  it('drops a commission whose commissionOfferId no longer resolves to real content', () => {
    mockContentLookup(caravan);
    const commissions: GameStateCommissions = {
      [caravan.id]: {
        commissionOfferId: offer.id,
        requirements: [],
        completed: false,
        generatedAt: 1000,
      },
    };

    expect(pruneInvalidCommissions(commissions)).toEqual({});
  });

  it('drops a commission keyed by a caravan that no longer resolves to real content', () => {
    mockContentLookup(offer);
    const commissions: GameStateCommissions = {
      [caravan.id]: {
        commissionOfferId: offer.id,
        requirements: [],
        completed: false,
        generatedAt: 1000,
      },
    };

    expect(pruneInvalidCommissions(commissions)).toEqual({});
  });

  it('keeps a commission with no commissionOfferId (never successfully generated), as long as the caravan resolves', () => {
    mockContentLookup(caravan);
    const commissions: GameStateCommissions = {
      [caravan.id]: {
        commissionOfferId: undefined,
        requirements: [],
        completed: false,
        generatedAt: 1000,
      },
    };

    expect(pruneInvalidCommissions(commissions)).toEqual(commissions);
  });
});

describe('commissionGenerateIfMissing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when a commission already exists, even a stale one', () => {
    withCommissionState({
      [caravan.id]: {
        commissionOfferId: offer.id,
        requirements: [],
        completed: true,
        generatedAt: 1,
      },
    });

    commissionGenerateIfMissing(caravan.id);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('does nothing when the caravan id no longer resolves to real content', () => {
    withCommissionState({});
    vi.mocked(getEntry).mockReturnValue(undefined);

    commissionGenerateIfMissing(caravan.id);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('generates immediately when no commission exists yet for the caravan', () => {
    withCommissionState({});
    vi.mocked(getEntry).mockReturnValue(caravan);
    vi.mocked(rngChoiceWeighted).mockReturnValue({ offer, weight: 1 });
    vi.mocked(rngNumberRange).mockReturnValue(100);
    vi.spyOn(Date, 'now').mockReturnValue(9000);

    commissionGenerateIfMissing(caravan.id);

    expect(updateGamestate).toHaveBeenCalledTimes(1);
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      world: { commissions: {} },
    } as unknown as GameState);

    expect(result.world.commissions[caravan.id]).toEqual({
      commissionOfferId: offer.id,
      requirements: [{ itemId: 'wergen-stick', quantity: 100 }],
      completed: false,
      generatedAt: 9000,
    });
  });
});
