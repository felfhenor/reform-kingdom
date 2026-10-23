import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { mostRecentCommissionResetAt } from '@helpers/commission/commission-reset';
import {
  commissionGenerateIfMissing,
  commissionProcessTick,
  pruneInvalidCommissions,
} from '@helpers/commission/commission-tick';
import { ensureCaravan } from '@helpers/content/ensure-caravan';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import { worldCommissionsState } from '@helpers/state-game';
import type {
  CaravanContent,
  CaravanId,
  CommissionNodeState,
  CommissionOfferId,
  ItemId,
} from '@interfaces';
import { buildCommissionNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const now = Date.UTC(2026, 9, 2, 18);
const resetAt = mostRecentCommissionResetAt(now);

const offer = ensureCommissionOffer({
  id: 'offer-a' as CommissionOfferId,
  name: 'Bundle of Wergen Sticks',
  requirements: [
    { itemId: 'wergen-stick' as ItemId, quantityMin: 100, quantityMax: 100 },
  ],
});

const starter = ensureCommissionOffer({
  id: 'offer-starter' as CommissionOfferId,
  name: 'Crate of Duchy Staples',
  requirements: [
    { itemId: 'copper-ore' as ItemId, quantityMin: 75, quantityMax: 75 },
  ],
});

function caravan(
  offers = [offer],
  startingCommissionOfferId?: CommissionOfferId,
): CaravanContent {
  return ensureCaravan({
    id: 'carrina-duchy' as CaravanId,
    name: 'Duchy Trading Caravan - Carrina',
    startingCommissionOfferId,
    commissionOffers: offers.map((o) => ({
      commissionOfferId: o.id,
      weight: 1,
    })),
  });
}

const freshCommission = {
  commissionOfferId: offer.id,
  requirements: [{ itemId: 'wergen-stick' as ItemId, quantity: 100 }],
  completed: false,
  generatedAt: now,
};

function seedCaravan(
  content: CaravanContent,
  existing?: Partial<CommissionNodeState>,
): void {
  seedContent([content, offer, starter]);
  seedWorldNodes([
    { name: content.name, type: 'CaravanNode', x: 1 },
    { name: 'Abandoned Camp', type: 'CaravanNode', x: 2 },
  ]);
  seedGamestate((state) => {
    if (existing) {
      state.world.commissions[content.id] = buildCommissionNodeState(existing);
    }
  });
}

function commission(): CommissionNodeState | undefined {
  return worldCommissionsState()[caravan().id];
}

beforeEach(() => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
  onTestFinished(() => clock.mockRestore());
});

describe('commissionProcessTick', () => {
  const tick = () => inTick(commissionProcessTick);

  it('rolls a fresh commission for a caravan that never had one', () => {
    seedCaravan(caravan());

    tick();

    expect(commission()).toEqual(freshCommission);
  });

  it('rerolls only once the daily reset has passed since the last roll', () => {
    const kept = { commissionOfferId: offer.id, generatedAt: resetAt };
    seedCaravan(caravan(), kept);
    tick();
    expect(commission()).toMatchObject(kept);

    seedCaravan(caravan(), {
      commissionOfferId: offer.id,
      generatedAt: resetAt - 1,
      completed: true,
    });
    tick();
    expect(commission()).toEqual(freshCommission);
  });

  it('opens on the starting offer, then rerolls from the pool', () => {
    seedCaravan(caravan([offer], starter.id));
    tick();
    expect(commission()).toMatchObject({
      commissionOfferId: starter.id,
      requirements: [{ itemId: 'copper-ore', quantity: 75 }],
      isStartingCommission: true,
    });

    seedCaravan(caravan([offer], starter.id), {
      commissionOfferId: starter.id,
      generatedAt: resetAt - 1,
      completed: true,
      isStartingCommission: true,
    });
    tick();
    expect(commission()).toEqual(freshCommission);
  });

  it('keeps an unfulfilled starting commission past the daily reset', () => {
    const kept = {
      commissionOfferId: starter.id,
      generatedAt: resetAt - 1,
      isStartingCommission: true,
    };
    seedCaravan(caravan([offer], starter.id), kept);

    tick();

    expect(commission()).toMatchObject(kept);
  });

  it('writes nothing when no offer resolves, so the next tick retries', () => {
    seedCaravan(caravan([]));

    tick();

    expect(commission()).toBeUndefined();
  });
});

describe('commissionGenerateIfMissing', () => {
  const generate = () =>
    inTick(() => commissionGenerateIfMissing(caravan().id));

  it('rolls a commission for a caravan without one, leaving even a stale one alone', () => {
    seedCaravan(caravan());
    generate();
    expect(commission()).toEqual(freshCommission);

    const stale = {
      commissionOfferId: offer.id,
      generatedAt: 1,
      completed: true,
    };
    seedCaravan(caravan(), stale);
    generate();
    expect(commission()).toMatchObject(stale);
  });

  it('does nothing for a caravan no longer in content', () => {
    seedGamestate();

    generate();

    expect(commission()).toBeUndefined();
  });
});

describe('pruneInvalidCommissions', () => {
  it('drops commissions whose caravan or offer left content, keeping offer-less ones', () => {
    const content = caravan();
    seedContent([content, offer]);
    const valid = buildCommissionNodeState({ commissionOfferId: offer.id });
    const unrolled = buildCommissionNodeState();

    expect(
      pruneInvalidCommissions({
        [content.id]: valid,
        ['removed-caravan' as CaravanId]: valid,
      }),
    ).toEqual({ [content.id]: valid });
    expect(pruneInvalidCommissions({ [content.id]: unrolled })).toEqual({
      [content.id]: unrolled,
    });

    seedContent([content]);
    expect(pruneInvalidCommissions({ [content.id]: valid })).toEqual({});
  });
});
