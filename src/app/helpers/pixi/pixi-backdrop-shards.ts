import {
  BACKDROP_FIELD_MARGIN_PX,
  BACKDROP_SHARD_FAST_TUMBLE_CHANCE,
  BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MAX_MS,
  BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MIN_MS,
  BACKDROP_SHARD_ALPHA_MAX,
  BACKDROP_SHARD_ALPHA_MIN,
  BACKDROP_SHARD_BASE_SIZE_PX,
  BACKDROP_SHARD_COLORS,
  BACKDROP_SHARD_COUNT,
  BACKDROP_SHARD_DEPTH_MAX,
  BACKDROP_SHARD_DEPTH_MIN,
  BACKDROP_SHARD_FLARE_FRACTION,
  BACKDROP_SHARD_FLOAT_SPEED_X,
  BACKDROP_SHARD_FLOAT_SPEED_Y,
  BACKDROP_SHARD_BACKFACE_LIGHT,
  BACKDROP_SHARD_GLINT_CHANCE,
  BACKDROP_SHARD_GLINT_REACH_MAX_PX,
  BACKDROP_SHARD_HIGHLIGHT_EDGE_CHANCE,
  BACKDROP_SHARD_LIGHT_MIN,
  BACKDROP_SHARD_MEMORY_CHANCE,
  BACKDROP_SHARD_MEMORY_SIZE_SCALE,
  BACKDROP_SHARD_PERIOD_MAX_MS,
  BACKDROP_SHARD_PERIOD_MIN_MS,
  BACKDROP_SHARD_QUAD_CHANCE,
  BACKDROP_SHARD_SHADE_MAX,
  BACKDROP_SHARD_SHADE_MIN,
  BACKDROP_SHARD_SHIMMER_PERIOD_MS,
  BACKDROP_SHARD_TUMBLE_PERIOD_MAX_MS,
  BACKDROP_SHARD_TUMBLE_PERIOD_MIN_MS,
  BACKDROP_SHARD_WOBBLE_SPEED,
  BACKDROP_STAR_COUNT,
  BACKDROP_STAR_PULSE_SPEED,
} from '@helpers/config';
import { rngChoice, rngSeeded } from '@helpers/rng';
import type {
  BackdropShard,
  BackdropShardState,
  BackdropStar,
} from '@interfaces';
import { clamp, range, sortBy } from 'es-toolkit/compat';
import type { PRNG } from 'seedrandom';

const TAU = Math.PI * 2;

function backdropRoll(rng: PRNG, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function backdropColorShade(color: number, shade: number): number {
  const channel = (shift: number) =>
    Math.round(clamp(((color >> shift) & 0xff) * shade, 0, 255));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Corners at jittered radii around a random base angle, so each shard is an irregular low-poly facet.
function backdropShardVertices(rng: PRNG): number[] {
  const sides = rng() < BACKDROP_SHARD_QUAD_CHANCE ? 4 : 3;
  const baseAngle = rng() * TAU;
  return range(sides).flatMap((corner) => {
    const angle = (corner / sides) * TAU + baseAngle;
    const radius = backdropRoll(rng, 0.65, 1.35);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

function backdropShardTumbleSpeed(rng: PRNG): number {
  const isFast = rng() < BACKDROP_SHARD_FAST_TUMBLE_CHANCE;
  const periodMs = isFast
    ? backdropRoll(
        rng,
        BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MIN_MS,
        BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MAX_MS,
      )
    : backdropRoll(
        rng,
        BACKDROP_SHARD_TUMBLE_PERIOD_MIN_MS,
        BACKDROP_SHARD_TUMBLE_PERIOD_MAX_MS,
      );
  return ((rng() < 0.5 ? -1 : 1) * TAU) / periodMs;
}

function backdropShardCreate(rng: PRNG): BackdropShard {
  const periodMs = backdropRoll(
    rng,
    BACKDROP_SHARD_PERIOD_MIN_MS,
    BACKDROP_SHARD_PERIOD_MAX_MS,
  );

  return {
    fieldX: rng(),
    fieldY: rng(),
    depth: backdropRoll(
      rng,
      BACKDROP_SHARD_DEPTH_MIN,
      BACKDROP_SHARD_DEPTH_MAX,
    ),
    // Skewed small, so large shards stay rare.
    sizePx: BACKDROP_SHARD_BASE_SIZE_PX * (0.4 + rng() ** 1.45 * 0.95),
    vertices: backdropShardVertices(rng),
    color: backdropColorShade(
      rngChoice([...BACKDROP_SHARD_COLORS], rng),
      backdropRoll(rng, BACKDROP_SHARD_SHADE_MIN, BACKDROP_SHARD_SHADE_MAX),
    ),
    alpha: backdropRoll(
      rng,
      BACKDROP_SHARD_ALPHA_MIN,
      BACKDROP_SHARD_ALPHA_MAX,
    ),
    hasHighlightEdge: rng() < BACKDROP_SHARD_HIGHLIGHT_EDGE_CHANCE,
    glintReachPx: 0,
    periodMs,
    phaseMs: rng() * periodMs,
    tumbleAxis: rng() * Math.PI,
    tumblePhase: rng() * TAU,
    tumbleSpeedPerMs: backdropShardTumbleSpeed(rng),
    shimmerPhase: rng(),
    floatPhaseX: rng() * TAU,
    floatPhaseY: rng() * TAU,
    floatSpeedX: backdropRoll(rng, 0.35, 1.2),
    floatSpeedY: backdropRoll(rng, 0.3, 0.95),
    floatAmplitudeX: backdropRoll(rng, 3, 16),
    floatAmplitudeY: backdropRoll(rng, 3, 14),
    wobbleAmplitude: backdropRoll(rng, 0.025, 0.1),
  };
}

function backdropShardMemoryRoll(
  shard: BackdropShard,
  rng: PRNG,
): BackdropShard {
  if (rng() >= BACKDROP_SHARD_MEMORY_CHANCE) return shard;

  return {
    ...shard,
    sizePx:
      BACKDROP_SHARD_BASE_SIZE_PX *
      BACKDROP_SHARD_MEMORY_SIZE_SCALE *
      backdropRoll(rng, 0.8, 1.2),
    memoryPick: rng(),
  };
}

// Rolled after the memory roll, since a memory shard's larger size feeds the reach.
function backdropShardGlintRoll(
  shard: BackdropShard,
  rng: PRNG,
): BackdropShard {
  if (rng() >= BACKDROP_SHARD_GLINT_CHANCE) return shard;

  return {
    ...shard,
    glintReachPx: Math.min(shard.sizePx, BACKDROP_SHARD_GLINT_REACH_MAX_PX),
  };
}

export function backdropShardsGenerate(seed: string): BackdropShard[] {
  const rng = rngSeeded(`${seed}:backdrop-shards`);
  const shards = range(BACKDROP_SHARD_COUNT).map(() =>
    backdropShardGlintRoll(
      backdropShardMemoryRoll(backdropShardCreate(rng), rng),
      rng,
    ),
  );
  // Far shards first, so nearer (faster-parallax) shards paint over them.
  return sortBy(shards, (shard) => shard.depth);
}

export function backdropStarsGenerate(seed: string): BackdropStar[] {
  const rng = rngSeeded(`${seed}:backdrop-stars`);
  return range(BACKDROP_STAR_COUNT).map(() => ({
    fieldX: rng(),
    fieldY: rng(),
    radiusPx: backdropRoll(rng, 0.3, 1.4),
    phase: rng() * TAU,
  }));
}

export function backdropShardFlare(
  shard: BackdropShard,
  nowMs: number,
): number {
  const cycles = (nowMs + shard.phaseMs) / shard.periodMs;
  const progress = cycles - Math.floor(cycles);
  if (progress >= BACKDROP_SHARD_FLARE_FRACTION) return 0;

  return Math.sin((progress / BACKDROP_SHARD_FLARE_FRACTION) * Math.PI) ** 2;
}

export function backdropShardFacing(
  shard: BackdropShard,
  nowMs: number,
): number {
  return Math.cos(nowMs * shard.tumbleSpeedPerMs + shard.tumblePhase);
}

export function backdropShardLight(facing: number): number {
  const lit =
    BACKDROP_SHARD_LIGHT_MIN +
    (1 - BACKDROP_SHARD_LIGHT_MIN) * Math.abs(facing);
  return facing < 0 ? lit * BACKDROP_SHARD_BACKFACE_LIGHT : lit;
}

function backdropWave(nowMs: number, speed: number, phase: number): number {
  return Math.sin(nowMs * speed + phase);
}

export function backdropShardState(
  shard: BackdropShard,
  nowMs: number,
  isMotionReduced = false,
): BackdropShardState {
  // Reduced motion holds position, angle and size still, but keeps the twinkle since it only fades light in and out.
  const motionMs = isMotionReduced ? 0 : nowMs;
  const flare = backdropShardFlare(shard, nowMs);
  const facing = backdropShardFacing(shard, motionMs);
  const { floatSpeedX: speedX, floatSpeedY: speedY } = shard;
  const wobble =
    backdropWave(
      motionMs,
      BACKDROP_SHARD_WOBBLE_SPEED * speedX,
      shard.floatPhaseY,
    ) * shard.wobbleAmplitude;
  const shimmer = backdropWave(
    nowMs,
    TAU / BACKDROP_SHARD_SHIMMER_PERIOD_MS,
    shard.shimmerPhase * TAU,
  );

  return {
    offsetX:
      backdropWave(
        motionMs,
        BACKDROP_SHARD_FLOAT_SPEED_X * speedX,
        shard.floatPhaseX,
      ) * shard.floatAmplitudeX,
    offsetY:
      backdropWave(
        motionMs,
        BACKDROP_SHARD_FLOAT_SPEED_Y * speedY,
        shard.floatPhaseY + Math.PI / 2,
      ) * shard.floatAmplitudeY,
    rotation: wobble,
    facing,
    light: backdropShardLight(facing),
    alpha: shard.alpha + (1 - shard.alpha) * flare,
    scale: isMotionReduced ? 1 : 1 + 0.15 * flare,
    // Glare follows the face toward the viewer, so an edge-on shard never flashes as a bright sliver.
    shimmer: flare * Math.abs(facing) * (0.5 + 0.5 * shimmer),
    // Only the very top of the flare sparkles, so the glint reads as a brief star-glint.
    glint: shard.glintReachPx > 0 ? flare ** 6 : 0,
    glintScale: isMotionReduced ? 1 : 0.4 + 0.6 * flare ** 6,
  };
}

// Same scale on both axes keeps the tile square, and fitting the widest corner keeps every uv inside its own tile.
export function backdropShardTileUvs(vertices: number[]): number[] {
  const reach = Math.max(...vertices.map((value) => Math.abs(value)));
  return vertices.map((value) => 0.5 + value / (reach * 2));
}

export function backdropShardFanIndices(cornerCount: number): number[] {
  return range(1, cornerCount - 1).flatMap((corner) => [0, corner, corner + 1]);
}

export function backdropStarAlpha(star: BackdropStar, nowMs: number): number {
  const pulse =
    (backdropWave(nowMs, BACKDROP_STAR_PULSE_SPEED, star.phase) + 1) / 2;
  return 0.08 + pulse * 0.24;
}

// Wraps within [-margin, size + margin) so a shard leaving one edge re-enters the opposite one.
export function backdropShardWrap(
  fieldFraction: number,
  cameraPx: number,
  depth: number,
  viewSizePx: number,
): number {
  const span = viewSizePx + BACKDROP_FIELD_MARGIN_PX * 2;
  const shifted = fieldFraction * span - cameraPx * depth;
  return (((shifted % span) + span) % span) - BACKDROP_FIELD_MARGIN_PX;
}
