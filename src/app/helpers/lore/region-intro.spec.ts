import { describe, expect, it } from 'vitest';

import { ensureRegion } from '@helpers/content/ensure-region';
import {
  isRegionIntroSeen,
  regionForMap,
  regionIntroPending,
  regionNameForMap,
} from '@helpers/lore/region-intro';
import type { RegionId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

function seedRegions(): void {
  seedContent([
    ensureRegion({
      id: 'mire' as RegionId,
      name: 'Craggled Mire',
      mapName: 'CraggledMire',
      description: 'A swamp.',
    }),
    ensureRegion({
      id: 'blank' as RegionId,
      name: 'Blank Region',
      mapName: 'Blank',
    }),
  ]);
}

describe('regionForMap', () => {
  it('finds the region by its map, not its name', () => {
    seedRegions();

    expect(regionForMap('CraggledMire')?.name).toBe('Craggled Mire');
    expect(regionForMap('Craggled Mire')).toBeUndefined();
  });
});

describe('regionNameForMap', () => {
  it('falls back to the map name when no region claims it', () => {
    seedRegions();

    expect(regionNameForMap('CraggledMire')).toBe('Craggled Mire');
    expect(regionNameForMap('Nowhere')).toBe('Nowhere');
  });
});

describe('regionIntroPending', () => {
  it('returns the region until its intro has been seen', () => {
    seedRegions();
    seedGamestate();

    expect(regionIntroPending('CraggledMire')?.name).toBe('Craggled Mire');

    seedGamestate((state) => {
      state.regionIntros['CraggledMire'] = { foundAt: 1000 };
    });

    expect(isRegionIntroSeen('CraggledMire')).toBe(true);
    expect(regionIntroPending('CraggledMire')).toBeUndefined();
  });

  it('skips maps with no region or an empty blurb', () => {
    seedRegions();
    seedGamestate();

    expect(regionIntroPending('Blank')).toBeUndefined();
    expect(regionIntroPending('Nowhere')).toBeUndefined();
  });
});
