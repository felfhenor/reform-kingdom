import { describe, expect, it } from 'vitest';

import { noiseSpeckleGrid, noiseValue2dCreate } from '@helpers/noise';

describe('noiseValue2dCreate', () => {
  it('is deterministic for the same seed', () => {
    const a = noiseValue2dCreate('map-a');
    const b = noiseValue2dCreate('map-a');
    expect(a(3.7, 12.2)).toBe(b(3.7, 12.2));
  });

  it('differs between seeds', () => {
    const a = noiseValue2dCreate('map-a');
    const b = noiseValue2dCreate('map-b');
    const samples = [0.5, 1.5, 2.5, 3.5, 4.5];
    expect(samples.map((x) => a(x, x))).not.toEqual(
      samples.map((x) => b(x, x)),
    );
  });

  it('stays within [0, 1], including negative coordinates', () => {
    const sampler = noiseValue2dCreate('bounds');
    for (let i = -50; i < 50; i++) {
      const value = sampler(i * 0.37, i * -0.61);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous across lattice boundaries', () => {
    const sampler = noiseValue2dCreate('smooth');
    expect(Math.abs(sampler(2 - 1e-6, 5) - sampler(2, 5))).toBeLessThan(1e-4);
  });
});

describe('noiseSpeckleGrid', () => {
  it('is deterministic for the same seed', () => {
    expect(noiseSpeckleGrid('map-a', 40, 30, 8, 0.5)).toEqual(
      noiseSpeckleGrid('map-a', 40, 30, 8, 0.5),
    );
  });

  it('returns one flag per cell', () => {
    expect(noiseSpeckleGrid('size', 7, 5, 8, 0.5)).toHaveLength(35);
  });

  it('never speckles at zero density', () => {
    expect(noiseSpeckleGrid('empty', 20, 20, 8, 0)).not.toContain(true);
  });

  it('stays sparse at low density', () => {
    const grid = noiseSpeckleGrid('sparse', 100, 100, 24, 0.12);
    const speckled = grid.filter(Boolean).length;
    expect(speckled).toBeGreaterThan(0);
    expect(speckled / grid.length).toBeLessThan(0.12);
  });
});
