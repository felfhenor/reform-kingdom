import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

vi.mock('@helpers/commission/commission-tick');

import {
  caravanBrandName,
  caravanBusyTraderIds,
  caravanEligibleTraders,
  caravanMarkVisited,
  caravanTicksUntilReset,
  caravanTimerLabel,
  caravanTimerUrgency,
  isCaravanDiscovered,
  isPartyAtCaravan,
} from '@helpers/caravan/caravan';
import { commissionGenerateIfMissing } from '@helpers/commission/commission-tick';
import {
  URGENCY_SAFE_MIN_TICKS,
  URGENCY_WARNING_MIN_TICKS,
} from '@helpers/config';
import {
  ensureCaravan,
  ensureCaravanTrader,
} from '@helpers/content/ensure-caravan';
import { formatDuration } from '@helpers/engine/timer';
import { gamestate, worldCaravansState } from '@helpers/state-game';
import type {
  CaravanId,
  CaravanNodeState,
  CaravanTraderContent,
  CaravanTraderId,
} from '@interfaces';
import { buildCaravanNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const caravan = ensureCaravan({
  id: 'carrina-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Carrina',
  traderResetTime: 100,
  level: { min: 3, max: 7 },
  traderCategories: ['Carrina'],
});
const otherCaravan = ensureCaravan({
  id: 'elfheim-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Elfheim',
});
const traderA = 'trader-a' as CaravanTraderId;
const traderB = 'trader-b' as CaravanTraderId;

function trader(
  overrides: Partial<CaravanTraderContent>,
): CaravanTraderContent {
  return ensureCaravanTrader({ category: 'Carrina', level: 5, ...overrides });
}

function seedCaravans(
  caravans: Partial<Record<CaravanId, CaravanNodeState>>,
  numTicks = 0,
): void {
  seedGamestate((state) => {
    state.clock.numTicks = numTicks;
    Object.assign(state.world.caravans, caravans);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([caravan, otherCaravan]);
});

describe('caravanEligibleTraders', () => {
  it('keeps traders of a matching category within the level range, inclusive', () => {
    const atMin = trader({ id: 'min' as CaravanTraderId, level: 3 });
    const atMax = trader({ id: 'max' as CaravanTraderId, level: 7 });
    seedContent([
      atMin,
      atMax,
      trader({ id: 'other' as CaravanTraderId, category: 'Elfheim' }),
      trader({ id: 'low' as CaravanTraderId, level: 2 }),
      trader({ id: 'high' as CaravanTraderId, level: 8 }),
    ]);

    expect(caravanEligibleTraders(caravan)).toEqual([atMin, atMax]);
  });
});

describe('caravanBusyTraderIds', () => {
  it('collects traders staffing every other caravan, skipping unstaffed ones', () => {
    seedCaravans({
      [caravan.id]: buildCaravanNodeState({ traderId: traderA }),
      [otherCaravan.id]: buildCaravanNodeState({ traderId: traderB }),
      ['empty' as CaravanId]: buildCaravanNodeState(),
    });

    expect(caravanBusyTraderIds(caravan.id)).toEqual(new Set([traderB]));
  });
});

describe('caravanTicksUntilReset / caravanTimerLabel', () => {
  it('counts down from the reset time since the trader was generated, never below 0', () => {
    const generated = buildCaravanNodeState({ generatedAtTick: 1000 });

    seedCaravans({}, 1040);
    expect(caravanTicksUntilReset(caravan, generated)).toBe(60);
    expect(caravanTimerLabel(caravan, generated)).toBe(formatDuration(60));

    seedCaravans({}, 1000 + caravan.traderResetTime + 1);
    expect(caravanTicksUntilReset(caravan, generated)).toBe(0);
  });

  it('is the full reset time before the caravan was ever generated', () => {
    expect(caravanTicksUntilReset(caravan, undefined)).toBe(
      caravan.traderResetTime,
    );
  });
});

describe('caravanTimerUrgency', () => {
  it('escalates from safe to warning to danger at the configured thresholds', () => {
    expect(caravanTimerUrgency(URGENCY_SAFE_MIN_TICKS)).toBe('safe');
    expect(caravanTimerUrgency(URGENCY_SAFE_MIN_TICKS - 1)).toBe('warning');
    expect(caravanTimerUrgency(URGENCY_WARNING_MIN_TICKS)).toBe('warning');
    expect(caravanTimerUrgency(URGENCY_WARNING_MIN_TICKS - 1)).toBe('danger');
  });
});

describe('caravanBrandName', () => {
  it('drops the branch suffix, if any', () => {
    expect(caravanBrandName(caravan.name)).toBe('Duchy Trading Caravan');
    expect(caravanBrandName('Goblin Group')).toBe('Goblin Group');
  });
});

describe('isPartyAtCaravan', () => {
  const nodes = () =>
    seedWorldNodes([
      { name: caravan.name, type: 'CaravanNode', x: 1 },
      { name: otherCaravan.name, type: 'CaravanNode', x: 2 },
      { name: 'Field', type: 'ExploreNode', x: 3 },
    ]);

  it('is true only while standing on that caravan’s node', () => {
    const entries = nodes();
    const standOn = (name: string) =>
      seedGamestate(
        (state) => (state.world.currentLocation = locationOf(entries[name])),
      );

    standOn(caravan.name);
    expect(isPartyAtCaravan(caravan.id)).toBe(true);

    standOn(otherCaravan.name);
    expect(isPartyAtCaravan(caravan.id)).toBe(false);

    standOn('Field');
    expect(isPartyAtCaravan(caravan.id)).toBe(false);

    seedGamestate(
      (state) =>
        (state.world.currentLocation = {
          ...locationOf(entries['Field']),
          x: 50,
        }),
    );
    expect(isPartyAtCaravan(caravan.id)).toBe(false);
  });
});

describe('caravanMarkVisited', () => {
  it('discovers the caravan once, backfills its commission and records the trader as visited', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(5000);
    onTestFinished(() => now.mockRestore());
    seedCaravans({
      [caravan.id]: buildCaravanNodeState({ traderId: traderA }),
    });

    inTick(() => caravanMarkVisited(caravan.id));
    now.mockReturnValue(9000);
    inTick(() => caravanMarkVisited(caravan.id));

    expect(isCaravanDiscovered(caravan.id)).toBe(true);
    expect(gamestate().discoveredCaravans[caravan.id]).toEqual({
      foundAt: 5000,
    });
    expect(commissionGenerateIfMissing).toHaveBeenCalledWith(caravan.id);
    expect(worldCaravansState()[caravan.id].visitedTraderId).toBe(traderA);
  });

  it('still discovers a caravan with no trader state yet', () => {
    seedCaravans({});

    inTick(() => caravanMarkVisited(caravan.id));

    expect(isCaravanDiscovered(caravan.id)).toBe(true);
    expect(worldCaravansState()).toEqual({});
  });
});
