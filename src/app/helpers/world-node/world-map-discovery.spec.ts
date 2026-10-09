import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { discoveredMapsState, updateGamestate } from '@helpers/state-game';
import {
  backfillDiscoveredMaps,
  isWorldMapVisited,
  pruneInvalidDiscoveredMaps,
  worldMapMarkVisited,
} from '@helpers/world-node/world-map-discovery';
import { inTick, seedGamestate } from '@/testing/gamestate';

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(5000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('worldMapMarkVisited', () => {
  it('records a first visit and keeps its foundAt on later visits', () => {
    seedGamestate((state) => {
      state.discoveredMaps['Carrina'] = { foundAt: 1000 };
    });

    inTick(() =>
      updateGamestate((state) => {
        worldMapMarkVisited(state, 'Carrina');
        worldMapMarkVisited(state, 'Duskmere');
        return state;
      }),
    );

    expect(discoveredMapsState()).toEqual({
      Carrina: { foundAt: 1000 },
      Duskmere: { foundAt: 5000 },
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

describe('pruneInvalidDiscoveredMaps', () => {
  it('drops maps that no longer exist', () => {
    expect(
      pruneInvalidDiscoveredMaps(
        { Carrina: { foundAt: 1 }, Gone: { foundAt: 2 } },
        (mapName) => mapName === 'Carrina',
      ),
    ).toEqual({ Carrina: { foundAt: 1 } });
  });
});
