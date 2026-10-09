import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  backfillDiscoveredMaps,
  isWorldMapVisited,
} from '@helpers/world-node/world-map-discovery';
import { seedGamestate } from '@/testing/gamestate';

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(5000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isWorldMapVisited', () => {
  it('reads the discoveredMaps ledger', () => {
    seedGamestate((state) => {
      state.discoveredMaps['Duskmere'] = { foundAt: 1000 };
    });

    expect(isWorldMapVisited('Duskmere')).toBe(true);
    expect(isWorldMapVisited('Elsewhere')).toBe(false);
  });
});

describe('backfillDiscoveredMaps', () => {
  it('adds missing maps without touching existing entries', () => {
    expect(
      backfillDiscoveredMaps({ Carrina: { foundAt: 1000 } }, [
        'Carrina',
        'Duskmere',
      ]),
    ).toEqual({ Carrina: { foundAt: 1000 }, Duskmere: { foundAt: 5000 } });
  });
});
