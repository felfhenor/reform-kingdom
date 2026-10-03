import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngChoiceWeighted: vi.fn(),
}));

import { TOWN_COMMISSION_TICK_INTERVAL } from '@helpers/config';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { ensureTown } from '@helpers/content/ensure-town';
import { rngChoiceWeighted } from '@helpers/rng';
import { updateGamestate, worldTownsState } from '@helpers/state-game';
import { TOWN_REPUTATION_THRESHOLDS } from '@helpers/town/reputation/town-reputation';
import {
  townCommissionProcessTick,
  townCommissionRefreshTierScaledSlots,
  townCommissionSlotCount,
} from '@helpers/town/town-commission-generate';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionOfferSlot,
  EligibleCommissionOffer,
  ItemId,
  MonsterId,
  TownCommissionSlotId,
  TownCommissionSlotState,
  TownContent,
  TownContentInput,
  TownId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const stickId = 'wergen-stick' as ItemId;

function offer(
  id: string,
  overrides: Partial<CommissionOfferContent> = {},
): CommissionOfferContent {
  return ensureCommissionOffer({
    id: id as CommissionOfferId,
    name: id,
    requirements: [{ itemId: stickId, quantityMin: 100, quantityMax: 100 }],
    ...overrides,
  });
}

const offerA = offer('offer-a');
const offerB = offer('offer-b');
const persistent = offer('offer-persistent');

function town(
  commissions: Partial<CommissionOfferSlot>[],
  overrides: TownContentInput = {},
): TownContent {
  return ensureTown({
    id: townId,
    name: 'Larsia',
    defense: {
      quests: {
        commissions: commissions.map((slot) => ({
          weight: 1,
          persistent: false,
          ...slot,
        })),
      },
    },
    ...overrides,
  });
}

function seedTown(content: TownContent): void {
  seedContent([content, offerA, offerB, persistent]);
}

function slot(
  commissionOffer: CommissionOfferContent,
  overrides: Partial<TownCommissionSlotState> = {},
): TownCommissionSlotState {
  return {
    id: `slot-${commissionOffer.id}` as TownCommissionSlotId,
    commissionOfferId: commissionOffer.id,
    requirements: [],
    generatedAtTick: 0,
    ...overrides,
  };
}

function seedSlots(
  commissionSlots: TownCommissionSlotState[] = [],
  reputationTier = 0,
): void {
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState({
      commissionSlots,
      reputation: TOWN_REPUTATION_THRESHOLDS[reputationTier],
    });
  });
}

function slotOfferIds(): string[] {
  return worldTownsState()[townId].commissionSlots.map(
    (entry) => entry.commissionOfferId,
  );
}

function rollPool(): EligibleCommissionOffer[] {
  return vi.mocked(rngChoiceWeighted).mock
    .calls[0][0] as EligibleCommissionOffer[];
}

// Advances the clock first, so a repeated tick is always due whatever the interval.
const tick = () =>
  inTick(() => {
    updateGamestate((state) => {
      state.clock.numTicks += TOWN_COMMISSION_TICK_INTERVAL;
      return state;
    });
    townCommissionProcessTick();
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rngChoiceWeighted).mockImplementation((items) => items[0]);
});

describe('townCommissionSlotCount', () => {
  it('opens at least one slot, and more with every reputation tier', () => {
    const counts = [0, 1, 2, 3, 4].map((tier) => {
      seedSlots([], tier);
      return townCommissionSlotCount(town([]));
    });

    expect(counts[0]).toBeGreaterThanOrEqual(1);
    counts.slice(1).forEach((count, i) => {
      expect(count).toBeGreaterThan(counts[i]);
    });
  });
});

describe('townCommissionProcessTick', () => {
  it('rolls a commission into an open slot, with its requirements', () => {
    seedTown(town([{ commissionOfferId: offerA.id }]));
    seedSlots();

    tick();

    expect(worldTownsState()[townId].commissionSlots).toEqual([
      expect.objectContaining({
        commissionOfferId: offerA.id,
        requirements: [{ itemId: stickId, quantity: 100 }],
      }),
    ]);
  });

  it('adds one rolled commission per tick, never past the slot count', () => {
    const offerC = offer('offer-c');
    const content = town([
      { commissionOfferId: offerA.id },
      { commissionOfferId: offerB.id },
      { commissionOfferId: offerC.id },
    ]);
    seedContent([content, offerA, offerB, offerC]);
    seedSlots([], 1);
    const slots = townCommissionSlotCount(town([]));

    tick();
    expect(slotOfferIds()).toEqual([offerA.id]);

    tick();
    expect(slotOfferIds()).toEqual([offerA.id, offerB.id]);

    expect(slots).toBeLessThan(3);
    tick();
    expect(slotOfferIds()).toHaveLength(slots);
  });

  it('skips the roll entirely once the town is fully stocked', () => {
    seedTown(
      town([
        { commissionOfferId: offerA.id },
        { commissionOfferId: offerB.id },
      ]),
    );
    seedSlots([slot(offerA)]);

    tick();

    expect(rngChoiceWeighted).not.toHaveBeenCalled();
    expect(slotOfferIds()).toEqual([offerA.id]);
  });

  it('leaves out offers already live, or asking for a material the town has plenty of', () => {
    const capped = offer('capped', {
      requirements: [
        { itemId: 'ore' as ItemId, quantityMin: 1, quantityMax: 1 },
      ],
    });
    const content = town(
      [
        { commissionOfferId: offerA.id },
        { commissionOfferId: offerB.id },
        { commissionOfferId: capped.id },
      ],
      {
        materialThresholds: [{ itemId: 'ore' as ItemId, maxQuantity: 10 }],
      },
    );
    seedContent([content, offerA, offerB, capped]);
    seedGamestate((state) => {
      state.world.towns[townId] = buildTownNodeState({
        commissionSlots: [slot(offerA)],
        reputation: TOWN_REPUTATION_THRESHOLDS[1],
        materials: { ['ore' as ItemId]: 10 },
      });
    });

    tick();

    expect(rollPool().map(({ offer: o }) => o.id)).toEqual([offerB.id]);
  });

  it('adds nothing when no offer can be picked', () => {
    vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);
    seedTown(town([{ commissionOfferId: offerA.id }]));
    seedSlots();

    tick();

    expect(slotOfferIds()).toEqual([]);
  });

  it('ignores a town never visited, and one processed within the interval', () => {
    seedTown(town([{ commissionOfferId: offerA.id }]));
    seedGamestate();
    tick();
    expect(worldTownsState()).toEqual({});

    seedGamestate((state) => {
      state.clock.numTicks = 1000;
      state.world.towns[townId] = buildTownNodeState({
        lastProcessedTick: { quest: 1001 - TOWN_COMMISSION_TICK_INTERVAL },
      });
    });
    inTick(townCommissionProcessTick);
    expect(slotOfferIds()).toEqual([]);
  });

  describe('persistent commissions', () => {
    it('always keeps a slot for each persistent offer, without duplicating it', () => {
      vi.mocked(rngChoiceWeighted).mockReturnValue(undefined);
      seedTown(town([{ commissionOfferId: persistent.id, persistent: true }]));
      seedSlots();

      tick();
      expect(slotOfferIds()).toEqual([persistent.id]);

      tick();
      expect(slotOfferIds()).toEqual([persistent.id]);
    });

    it('restores a missing persistent slot without rolling when the rolled slots are full', () => {
      seedTown(
        town([
          { commissionOfferId: persistent.id, persistent: true },
          { commissionOfferId: offerA.id },
          { commissionOfferId: offerB.id },
        ]),
      );
      seedSlots([slot(offerA)]);

      tick();

      expect(slotOfferIds()).toEqual([offerA.id, persistent.id]);
    });

    it('keeps persistent offers out of the roll pool and the slot cap', () => {
      seedTown(
        town([
          { commissionOfferId: persistent.id, persistent: true },
          { commissionOfferId: offerA.id },
        ]),
      );
      seedSlots([slot(persistent)]);

      tick();

      expect(rollPool().map(({ offer: o }) => o.id)).toEqual([offerA.id]);
      expect(slotOfferIds()).toEqual([persistent.id, offerA.id]);
    });
  });
});

describe('townCommissionRefreshTierScaledSlots', () => {
  const scaled = offer('scaled', {
    reputationTierMultipliers: [{ tier: 0, value: 5 }],
  });
  const stale = [{ itemId: stickId, quantity: 100 }];

  // A wide range, so an unwanted re-roll is visible against the stale 100.
  const unscaled = offer('unscaled', {
    requirements: [{ itemId: stickId, quantityMin: 1, quantityMax: 50 }],
  });

  beforeEach(() => seedContent([town([]), unscaled, scaled]));

  it('re-rolls a tier-scaled slot, leaving unscaled ones alone', async () => {
    seedSlots([
      slot(scaled, { requirements: stale }),
      slot(unscaled, { requirements: stale }),
    ]);

    await townCommissionRefreshTierScaledSlots(townId);

    const [scaledSlot, plainSlot] = worldTownsState()[townId].commissionSlots;
    expect(scaledSlot.requirements).toEqual([
      { itemId: stickId, quantity: 500 },
    ]);
    expect(plainSlot.requirements).toEqual(stale);
  });

  it('does nothing for a town never visited', async () => {
    seedGamestate();

    await townCommissionRefreshTierScaledSlots(townId);

    expect(worldTownsState()).toEqual({});
  });

  it('never re-rolls a slot with kill progress, which would wipe it', async () => {
    const kills = [
      { monsterId: 'sand-worm' as MonsterId, quantity: 5, progress: 3 },
    ];
    seedSlots([slot(scaled, { requirements: kills })]);

    await townCommissionRefreshTierScaledSlots(townId);

    expect(worldTownsState()[townId].commissionSlots[0].requirements).toEqual(
      kills,
    );
  });
});
