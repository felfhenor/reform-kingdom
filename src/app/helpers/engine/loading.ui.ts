import { rngShuffle } from '@helpers/rng';
import type {
  AtlasedImage,
  LoadingIcon,
  LoadingProgress,
  LoadingStep,
} from '@interfaces';
import type { PRNG } from 'seedrandom';

export function loadingProgressCalculate(
  steps: LoadingStep[],
): LoadingProgress {
  if (steps.length === 0) {
    return { percent: 100, label: 'Ready', isComplete: true };
  }

  const doneCount = steps.filter((step) => step.isDone).length;
  const activeStep = steps.find((step) => !step.isDone);

  return {
    percent: Math.round((doneCount / steps.length) * 100),
    label: (activeStep ?? steps[steps.length - 1]).label,
    isComplete: doneCount === steps.length,
  };
}

export function loadingIconPool(
  atlases: Record<string, Record<string, { x: number; y: number }>>,
): LoadingIcon[] {
  return Object.entries(atlases).flatMap(([sheet, assets]) =>
    Object.values(assets).map(({ x, y }) => ({
      spritesheet: sheet as AtlasedImage,
      x,
      y,
    })),
  );
}

export function loadingGridSize(
  width: number,
  height: number,
  cellPx: number,
): { cols: number; rows: number } {
  return {
    cols: Math.max(0, Math.ceil(width / cellPx)),
    rows: Math.max(0, Math.ceil(height / cellPx)),
  };
}

// Repeats reshuffled passes over the pool so a small pool still fills the grid without obvious tiling.
export function loadingIconGridFill(
  pool: LoadingIcon[],
  count: number,
  rng: PRNG,
): LoadingIcon[] {
  const cells: LoadingIcon[] = [];
  while (pool.length > 0 && cells.length < count) {
    cells.push(...rngShuffle(pool, rng).slice(0, count - cells.length));
  }
  return cells;
}
