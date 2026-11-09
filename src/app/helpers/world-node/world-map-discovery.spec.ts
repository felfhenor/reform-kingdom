import { describe, expect, it } from 'vitest';

import { isWorldMapVisited } from '@helpers/world-node/world-map-discovery';
import { seedGamestate } from '@/testing/gamestate';

describe('isWorldMapVisited', () => {
  it('reads the discoveredMaps ledger', () => {
    seedGamestate((state) => {
      state.discoveredMaps['Duskmere'] = { foundAt: 1000 };
    });

    expect(isWorldMapVisited('Duskmere')).toBe(true);
    expect(isWorldMapVisited('Elsewhere')).toBe(false);
  });
});
