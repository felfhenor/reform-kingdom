import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  formatDuration: vi.fn(),
  timerTicksElapsed: vi.fn(),
}));

import {
  caravanBrandName,
  caravanEligibleTraders,
  caravanState,
  caravanTicksUntilReset,
  caravanTimerLabel,
  caravanTimerUrgency,
} from '@helpers/caravan/caravan';
import { getEntriesByType } from '@helpers/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate } from '@helpers/state-game';
import type {
  CaravanContent,
  CaravanId,
  CaravanTraderContent,
  CaravanTraderId,
  GameState,
} from '@interfaces';

const caravan: CaravanContent = {
  id: 'carrina-duchy' as CaravanId,
  name: 'Duchy Trading Caravan - Carrina',
  __type: 'caravan',
  description: 'A caravan.',
  traderResetTime: 100,
  level: { min: 3, max: 7 },
  markupPercentages: { sell: 25, buy: -15 },
  traderCategories: ['Carrina'],
};

function trader(
  overrides: Partial<CaravanTraderContent> = {},
): CaravanTraderContent {
  return {
    id: 'trader' as CaravanTraderId,
    name: 'Trader',
    __type: 'caravantrader',
    description: 'A trader.',
    category: 'Carrina',
    level: 5,
    trades: [],
    ...overrides,
  };
}

describe('caravanState', () => {
  it('returns the caravan node state from gamestate', () => {
    const state = { traderId: 'trader' as CaravanTraderId };
    vi.mocked(gamestate).mockReturnValue({
      world: { caravans: { [caravan.id]: state } },
    } as unknown as GameState);

    expect(caravanState(caravan.id)).toBe(state);
  });

  it('returns undefined for a caravan with no state yet', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { caravans: {} },
    } as unknown as GameState);

    expect(caravanState(caravan.id)).toBeUndefined();
  });
});

describe('caravanEligibleTraders', () => {
  it('includes a trader matching category and within the level range', () => {
    const eligible = trader({ id: 'a' as CaravanTraderId, level: 5 });
    vi.mocked(getEntriesByType).mockReturnValue([eligible]);

    expect(caravanEligibleTraders(caravan)).toEqual([eligible]);
  });

  it('excludes a trader in a different category', () => {
    const other = trader({ category: 'Elfheim' });
    vi.mocked(getEntriesByType).mockReturnValue([other]);

    expect(caravanEligibleTraders(caravan)).toEqual([]);
  });

  it('excludes a trader below the caravan level range', () => {
    const tooLow = trader({ level: 1 });
    vi.mocked(getEntriesByType).mockReturnValue([tooLow]);

    expect(caravanEligibleTraders(caravan)).toEqual([]);
  });

  it('excludes a trader above the caravan level range', () => {
    const tooHigh = trader({ level: 20 });
    vi.mocked(getEntriesByType).mockReturnValue([tooHigh]);

    expect(caravanEligibleTraders(caravan)).toEqual([]);
  });
});

describe('caravanTicksUntilReset', () => {
  it('returns the full resetTime when no state exists yet', () => {
    expect(caravanTicksUntilReset(caravan, undefined)).toBe(100);
  });

  it('returns the remaining ticks since the last generation', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(1050);

    expect(
      caravanTicksUntilReset(caravan, {
        traderId: undefined,
        activeTradeIndices: [],
        tradeCounts: {},
        generatedAtTick: 1000,
      }),
    ).toBe(50);
  });

  it('clamps to 0 once past due', () => {
    vi.mocked(timerTicksElapsed).mockReturnValue(2000);

    expect(
      caravanTicksUntilReset(caravan, {
        traderId: undefined,
        activeTradeIndices: [],
        tradeCounts: {},
        generatedAtTick: 1000,
      }),
    ).toBe(0);
  });
});

describe('caravanTimerLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats the ticks-until-reset value', () => {
    vi.mocked(formatDuration).mockReturnValue('01:40');

    expect(caravanTimerLabel(caravan, undefined)).toBe('01:40');
    expect(formatDuration).toHaveBeenCalledWith(100);
  });
});

describe('caravanTimerUrgency', () => {
  it('is safe with 30+ minutes remaining', () => {
    expect(caravanTimerUrgency(1800)).toBe('safe');
    expect(caravanTimerUrgency(3600)).toBe('safe');
  });

  it('is a warning under 30 minutes but at least 5', () => {
    expect(caravanTimerUrgency(1799)).toBe('warning');
    expect(caravanTimerUrgency(300)).toBe('warning');
  });

  it('is a danger under 5 minutes', () => {
    expect(caravanTimerUrgency(299)).toBe('danger');
    expect(caravanTimerUrgency(0)).toBe('danger');
  });
});

describe('caravanBrandName', () => {
  it('drops the branch suffix after the dash', () => {
    expect(caravanBrandName('Goblin Group Company - Carrina')).toBe(
      'Goblin Group Company',
    );
  });

  it('returns the name unchanged when there is no dash', () => {
    expect(caravanBrandName('Goblin Group Company')).toBe(
      'Goblin Group Company',
    );
  });
});
