import { describe, expect, it } from 'vitest';

import {
  cameraBoundsCalculate,
  cameraOffsetFromDrag,
  cameraPositionCalculate,
  tileToScreenPosition,
  viewportTilesCalculate,
} from '@helpers/pixi/pixi-camera';

describe('cameraBoundsCalculate', () => {
  it('should extend half a tile past each edge when the map exceeds the viewport', () => {
    expect(cameraBoundsCalculate(10, 10, 50, 50)).toEqual({
      minX: -0.5,
      maxX: 39.5,
      minY: -0.5,
      maxY: 39.5,
    });
  });

  it('should pin the camera to zero when the map fits entirely in the viewport', () => {
    expect(cameraBoundsCalculate(20, 20, 10, 10)).toEqual({
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    });
  });
});

describe('cameraPositionCalculate', () => {
  it('should center the camera on the player away from any edge', () => {
    expect(cameraPositionCalculate(24, 24, 10, 10, 50, 50)).toEqual({
      x: 19,
      y: 19,
    });
  });

  it('should clamp half a tile past the left/top edge when the player is near the start', () => {
    expect(cameraPositionCalculate(1, 1, 10, 10, 50, 50)).toEqual({
      x: -0.5,
      y: -0.5,
    });
  });

  it('should clamp half a tile past the right/bottom edge when the player is near the end', () => {
    expect(cameraPositionCalculate(49, 49, 10, 10, 50, 50)).toEqual({
      x: 39.5,
      y: 39.5,
    });
  });

  it('should fill the viewport entirely when the map is smaller than the viewport', () => {
    expect(cameraPositionCalculate(5, 5, 20, 20, 10, 10)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('viewportTilesCalculate', () => {
  it('should divide screen pixels by tile size when unzoomed', () => {
    expect(viewportTilesCalculate(320, 320, 1, 32, 32)).toEqual({
      widthTiles: 10,
      heightTiles: 10,
    });
  });

  it('should shrink the visible tile count as zoom increases', () => {
    expect(viewportTilesCalculate(320, 320, 2, 32, 32)).toEqual({
      widthTiles: 5,
      heightTiles: 5,
    });
  });

  it('should support fractional zoom levels', () => {
    expect(viewportTilesCalculate(400, 200, 1.25, 32, 32)).toEqual({
      widthTiles: 10,
      heightTiles: 5,
    });
  });
});

describe('cameraOffsetFromDrag', () => {
  const base = { x: 19, y: 19 };
  const bounds = { minX: -0.5, maxX: 39.5, minY: -0.5, maxY: 39.5 };

  it('should move the offset opposite the drag direction, in tiles', () => {
    expect(
      cameraOffsetFromDrag({ x: 0, y: 0 }, 32, 16, 32, 32, base, bounds),
    ).toEqual({ x: -1, y: -0.5 });
  });

  it('should accumulate onto an existing offset', () => {
    expect(
      cameraOffsetFromDrag({ x: -1, y: 2 }, -32, 0, 32, 32, base, bounds),
    ).toEqual({ x: 0, y: 2 });
  });

  it('should clamp so the base plus offset never exceeds the map bounds', () => {
    expect(
      cameraOffsetFromDrag({ x: 0, y: 0 }, -100000, 0, 32, 32, base, bounds),
    ).toEqual({ x: bounds.maxX - base.x, y: 0 });
  });

  it('should clamp so the base plus offset never drops below the map bounds', () => {
    expect(
      cameraOffsetFromDrag({ x: 0, y: 0 }, 100000, 0, 32, 32, base, bounds),
    ).toEqual({ x: bounds.minX - base.x, y: 0 });
  });
});

describe('tileToScreenPosition', () => {
  it('centers the tile at the camera origin, offset by half a tile', () => {
    expect(tileToScreenPosition(0, 0, { x: 0, y: 0 }, 32, 32)).toEqual({
      x: -16,
      y: -16,
    });
  });

  it('offsets by the distance from the camera, in pixels', () => {
    expect(tileToScreenPosition(5, 3, { x: 2, y: 1 }, 32, 32)).toEqual({
      x: (5 - 2) * 32 - 16,
      y: (3 - 1) * 32 - 16,
    });
  });

  it('rounds to whole pixels to avoid subpixel tearing', () => {
    expect(tileToScreenPosition(1.4, 2.6, { x: 0, y: 0 }, 32, 32)).toEqual({
      x: Math.round(1.4 * 32 - 16),
      y: Math.round(2.6 * 32 - 16),
    });
  });
});
