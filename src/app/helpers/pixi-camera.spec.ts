import { describe, expect, it } from 'vitest';

import { cameraPositionCalculate } from '@helpers/pixi-camera';

describe('cameraPositionCalculate', () => {
  it('should center the camera on the player away from any edge', () => {
    expect(cameraPositionCalculate(24, 24, 10, 10, 50, 50)).toEqual({
      x: 19,
      y: 19,
    });
  });

  it('should clamp to the left/top edge when the player is near the start', () => {
    expect(cameraPositionCalculate(1, 1, 10, 10, 50, 50)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('should clamp to the right/bottom edge when the player is near the end', () => {
    expect(cameraPositionCalculate(49, 49, 10, 10, 50, 50)).toEqual({
      x: 40,
      y: 40,
    });
  });

  it('should fill the viewport entirely when the map is smaller than the viewport', () => {
    expect(cameraPositionCalculate(5, 5, 20, 20, 10, 10)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
