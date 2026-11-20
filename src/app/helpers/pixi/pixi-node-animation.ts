import { NODE_ANIMATION_CYCLE_MS } from '@helpers/config';

// phase in [0, 1) shifts where in the loop this node starts.
export function nodeAnimationFrameIndex(
  nowMs: number,
  frameCount: number,
  phase: number,
): number {
  const cycles = nowMs / NODE_ANIMATION_CYCLE_MS + phase;
  return Math.floor((cycles - Math.floor(cycles)) * frameCount);
}
