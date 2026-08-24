import { describe, expect, it } from 'vitest';

import { tiledGidOrientationRead } from '@helpers/pixi/pixi-map-render';

const HALF_PI = Math.PI / 2;

describe('tiledGidOrientationRead', () => {
  it('returns the gid unchanged with no flip flags set', () => {
    expect(tiledGidOrientationRead(57)).toEqual({
      gid: 57,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('handles horizontal flip alone', () => {
    expect(tiledGidOrientationRead(0x80000000 | 57)).toEqual({
      gid: 57,
      rotation: 0,
      scaleX: -1,
      scaleY: 1,
    });
  });

  it('handles vertical flip alone', () => {
    expect(tiledGidOrientationRead(0x40000000 | 57)).toEqual({
      gid: 57,
      rotation: 0,
      scaleX: 1,
      scaleY: -1,
    });
  });

  it('handles diagonal flip alone', () => {
    expect(tiledGidOrientationRead(0x20000000 | 57)).toEqual({
      gid: 57,
      rotation: HALF_PI,
      scaleX: 1,
      scaleY: -1,
    });
  });

  it('handles horizontal + vertical flip (180 degree rotation)', () => {
    expect(tiledGidOrientationRead(0x80000000 | 0x40000000 | 57)).toEqual({
      gid: 57,
      rotation: 0,
      scaleX: -1,
      scaleY: -1,
    });
  });

  it('handles horizontal + diagonal flip', () => {
    expect(tiledGidOrientationRead(0x80000000 | 0x20000000 | 57)).toEqual({
      gid: 57,
      rotation: HALF_PI,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('handles vertical + diagonal flip', () => {
    expect(tiledGidOrientationRead(0x40000000 | 0x20000000 | 57)).toEqual({
      gid: 57,
      rotation: HALF_PI,
      scaleX: -1,
      scaleY: -1,
    });
  });

  it('handles horizontal + vertical + diagonal flip', () => {
    expect(
      tiledGidOrientationRead(0x80000000 | 0x40000000 | 0x20000000 | 57),
    ).toEqual({
      gid: 57,
      rotation: HALF_PI,
      scaleX: -1,
      scaleY: 1,
    });
  });
});
