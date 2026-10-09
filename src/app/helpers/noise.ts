import { rngSeeded, rngShuffle } from '@helpers/rng';
import type { NoiseSampler2d } from '@interfaces';
import { range } from 'es-toolkit/compat';

const PERMUTATION_SIZE = 256;

function noiseSmoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function noiseLerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Returns values in [0, 1].
export function noiseValue2dCreate(seed: string): NoiseSampler2d {
  const perm = rngShuffle(range(PERMUTATION_SIZE), rngSeeded(seed));
  const corner = (cx: number, cy: number) =>
    perm[(perm[cx & 255] + cy) & 255] / (PERMUTATION_SIZE - 1);

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = noiseSmoothstep(x - x0);
    const ty = noiseSmoothstep(y - y0);
    const top = noiseLerp(corner(x0, y0), corner(x0 + 1, y0), tx);
    const bottom = noiseLerp(corner(x0, y0 + 1), corner(x0 + 1, y0 + 1), tx);
    return noiseLerp(top, bottom, ty);
  };
}

// Row-major speckle flags; speckles cluster where the low-frequency noise is high instead of spreading evenly.
export function noiseSpeckleGrid(
  seed: string,
  width: number,
  height: number,
  featureCells: number,
  density: number,
): boolean[] {
  const cluster = noiseValue2dCreate(seed);
  const rng = rngSeeded(`${seed}:speckle`);
  return range(width * height).map((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const clusterValue = cluster(x / featureCells, y / featureCells);
    return rng() < density * clusterValue * clusterValue;
  });
}
