import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/commission/commission-tick', () => ({
  commissionGenerateIfMissing: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/engine/timer', () => ({
  formatDuration: vi.fn(),
  timerTicksElapsed: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  worldNodeAtCurrentLocation: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(),
}));

import {
  caravanBrandName,
  caravanEligibleTraders,
  caravanMarkDiscovered,
  caravanMarkVisited,
  caravanState,
  caravanTicksUntilReset,
  caravanTimerLabel,
  caravanTimerUrgency,
  isCaravanDiscovered,
  isPartyAtCaravan,
  pruneInvalidDiscoveredCaravans,
} from '@helpers/caravan/caravan';
import { commissionGenerateIfMissing } from '@helpers/commission/commission-tick';
import { getEntriesByType, getEntry } from '@helpers/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CaravanTraderContent,
  CaravanTraderId,
  GameState,
  GameStateDiscoveredCaravans,
  WorldNodeEntry,
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
  commissionOffers: [],
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
    tokenTrades: [],
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

describe('isCaravanDiscovered', () => {
  it('is true once a foundAt is recorded', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredCaravans: { [caravan.id]: { foundAt: 1000 } },
    } as unknown as GameState);

    expect(isCaravanDiscovered(caravan.id)).toBe(true);
  });

  it('is false when never visited', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredCaravans: {},
    } as unknown as GameState);

    expect(isCaravanDiscovered(caravan.id)).toBe(false);
  });
});

describe('isPartyAtCaravan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false when the party is not on any world node', () => {
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(undefined);

    expect(isPartyAtCaravan(caravan.id)).toBe(false);
  });

  it('is false when the current node is a different caravan', () => {
    const entry = {} as WorldNodeEntry;
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(entry);
    vi.mocked(worldNodeCaravan).mockReturnValue({
      ...caravan,
      id: 'other-caravan' as CaravanId,
    });

    expect(isPartyAtCaravan(caravan.id)).toBe(false);
  });

  it('is true when standing on this caravan node', () => {
    const entry = {} as WorldNodeEntry;
    vi.mocked(worldNodeAtCurrentLocation).mockReturnValue(entry);
    vi.mocked(worldNodeCaravan).mockReturnValue(caravan);

    expect(isPartyAtCaravan(caravan.id)).toBe(true);
  });
});

describe('caravanMarkDiscovered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when already discovered', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredCaravans: { [caravan.id]: { foundAt: 1000 } },
    } as unknown as GameState);

    caravanMarkDiscovered(caravan.id);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('records a fresh foundAt when visited for the first time', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredCaravans: {},
    } as unknown as GameState);
    vi.spyOn(Date, 'now').mockReturnValue(5000);

    caravanMarkDiscovered(caravan.id);

    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const result = updateFn({
      discoveredCaravans: {},
    } as unknown as GameState);

    expect(result.discoveredCaravans[caravan.id]).toEqual({ foundAt: 5000 });

    vi.restoreAllMocks();
  });
});

describe('pruneInvalidDiscoveredCaravans', () => {
  it('keeps entries that resolve to real content', () => {
    vi.mocked(getEntry).mockReturnValue(caravan);
    const discovered: GameStateDiscoveredCaravans = {
      [caravan.id]: { foundAt: 1000 },
    };

    expect(pruneInvalidDiscoveredCaravans(discovered)).toEqual(discovered);
  });

  it('drops entries whose id no longer resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    const discovered: GameStateDiscoveredCaravans = {
      [caravan.id]: { foundAt: 1000 },
    };

    expect(pruneInvalidDiscoveredCaravans(discovered)).toEqual({});
  });
});

describe('caravanMarkVisited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks discovered and backfills the commission', () => {
    vi.mocked(gamestate).mockReturnValue({
      discoveredCaravans: {},
    } as unknown as GameState);

    caravanMarkVisited(caravan.id);

    expect(updateGamestate).toHaveBeenCalled();
    expect(commissionGenerateIfMissing).toHaveBeenCalledWith(caravan.id);
  });
});
