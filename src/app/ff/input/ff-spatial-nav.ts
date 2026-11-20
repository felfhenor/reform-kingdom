import type { FFAxis, FFDirection, FFRect } from '@ff/interfaces/ff-input';

const DIRECTION_AXES: Record<FFDirection, { axis: FFAxis; sign: 1 | -1 }> = {
  up: { axis: 'y', sign: -1 },
  down: { axis: 'y', sign: 1 },
  left: { axis: 'x', sign: -1 },
  right: { axis: 'x', sign: 1 },
};

// Sideways drift costs more than distance, so rows and columns win over diagonals.
const CROSS_AXIS_WEIGHT = 2;
const CROSS_CENTER_WEIGHT = 0.1;
// Candidates must start past the current edge; overlapping ones (e.g. a navbar above a side rail) aren't "ahead".
const EDGE_TOLERANCE = 2;

function ffSpan(rect: FFRect, axis: FFAxis): [number, number] {
  return axis === 'x' ? [rect.left, rect.right] : [rect.top, rect.bottom];
}

function ffSpanGap(
  [aStart, aEnd]: [number, number],
  [bStart, bEnd]: [number, number],
): number {
  return Math.max(0, bStart - aEnd, aStart - bEnd);
}

function ffSpanCenter([start, end]: [number, number]): number {
  return (start + end) / 2;
}

function ffDirectionalScore(
  from: FFRect,
  to: FFRect,
  direction: FFDirection,
): number | undefined {
  const { axis, sign } = DIRECTION_AXES[direction];
  const cross: FFAxis = axis === 'x' ? 'y' : 'x';
  const [fromStart, fromEnd] = ffSpan(from, axis);
  const [toStart, toEnd] = ffSpan(to, axis);

  const ahead =
    sign > 0
      ? toStart >= fromEnd - EDGE_TOLERANCE
      : toEnd <= fromStart + EDGE_TOLERANCE;
  if (!ahead) return undefined;

  const distance = Math.max(
    0,
    sign > 0 ? toStart - fromEnd : fromStart - toEnd,
  );
  const drift = ffSpanGap(ffSpan(from, cross), ffSpan(to, cross));
  const centerDrift = Math.abs(
    ffSpanCenter(ffSpan(to, cross)) - ffSpanCenter(ffSpan(from, cross)),
  );
  return (
    distance + drift * CROSS_AXIS_WEIGHT + centerDrift * CROSS_CENTER_WEIGHT
  );
}

export function ffNearestInDirection(
  from: FFRect,
  candidates: FFRect[],
  direction: FFDirection,
): number {
  return candidates.reduce(
    (best, candidate, index) => {
      const score = ffDirectionalScore(from, candidate, direction);
      return score !== undefined && score < best.score
        ? { index, score }
        : best;
    },
    { index: -1, score: Infinity },
  ).index;
}

function ffCenterDistance(a: FFRect, b: FFRect): number {
  const dx = (a.left + a.right - b.left - b.right) / 2;
  const dy = (a.top + a.bottom - b.top - b.bottom) / 2;
  return Math.hypot(dx, dy);
}

// Any direction: where focus recovers to when the focused element disappears or disables.
export function ffNearestTo(from: FFRect, candidates: FFRect[]): number {
  return candidates.reduce(
    (best, candidate, index) => {
      const distance = ffCenterDistance(from, candidate);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: -1, distance: Infinity },
  ).index;
}
