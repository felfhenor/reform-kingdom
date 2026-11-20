import {
  NODE_SPARKLE_ALPHA_MAX,
  NODE_SPARKLE_INSET,
  NODE_SPARKLE_MOTE_COUNT,
  NODE_SPARKLE_PERIOD_MS,
  NODE_SPARKLE_RISE,
  NODE_SPARKLE_SPAWN_MIN,
  NODE_SPARKLE_SPAWN_RANGE,
} from '@helpers/config';
import type { NodeSparkleMoteState } from '@interfaces';
import { range } from 'es-toolkit/compat';

// Cheap stable hash to [0, 1), so motes move somewhere new each cycle without per-frame RNG state.
export function nodeSparkleHash(value: number): number {
  const scaled = Math.sin(value * 12.9898) * 43758.5453;
  return scaled - Math.floor(scaled);
}

// Evenly staggered from a per-node offset, so a node's motes never pulse together.
export function nodeSparkleMotePhases(seed: number): number[] {
  const offset = nodeSparkleHash(seed);
  return range(NODE_SPARKLE_MOTE_COUNT).map(
    (index) => (offset + index / NODE_SPARKLE_MOTE_COUNT) % 1,
  );
}

function nodeSparkleMoteAt(
  cycle: number,
  progress: number,
  phase: number,
): NodeSparkleMoteState {
  const key = cycle + phase * 1000;
  const spawnY =
    NODE_SPARKLE_SPAWN_MIN +
    nodeSparkleHash(key + 0.5) * NODE_SPARKLE_SPAWN_RANGE;
  return {
    x: NODE_SPARKLE_INSET + nodeSparkleHash(key) * (1 - 2 * NODE_SPARKLE_INSET),
    y: spawnY + progress * NODE_SPARKLE_RISE,
    alpha: Math.sin(Math.PI * progress) * NODE_SPARKLE_ALPHA_MAX,
  };
}

export function nodeSparkleMoteState(
  nowMs: number,
  phase: number,
): NodeSparkleMoteState {
  const cycles = nowMs / NODE_SPARKLE_PERIOD_MS + phase;
  const cycle = Math.floor(cycles);
  return nodeSparkleMoteAt(cycle, cycles - cycle, phase);
}

// Reduced motion: a fixed glint per mote, held mid-drift at full (still dim) brightness.
export function nodeSparkleMoteStill(phase: number): NodeSparkleMoteState {
  return nodeSparkleMoteAt(0, 0.5, phase);
}
