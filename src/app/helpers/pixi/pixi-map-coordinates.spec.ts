import { mapCoordinatesAt } from '@helpers/pixi/pixi-map-coordinates';
import { describe, expect, it } from 'vitest';

const map = { width: 10, height: 8, tilewidth: 64, tileheight: 64 };

describe('mapCoordinatesAt', () => {
  it('gives the tile and the bottom-left anchor a Tiled object uses', () => {
    expect(mapCoordinatesAt(map, 130, 70)).toEqual({
      tileX: 2,
      tileY: 1,
      patchX: 128,
      patchY: 128,
    });
  });

  it('is undefined off the map', () => {
    expect(mapCoordinatesAt(map, -1, 10)).toBeUndefined();
    expect(mapCoordinatesAt(map, 640, 10)).toBeUndefined();
    expect(mapCoordinatesAt(map, 10, 512)).toBeUndefined();
  });
});
