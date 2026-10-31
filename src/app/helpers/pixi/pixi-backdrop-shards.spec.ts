import {
  BACKDROP_FIELD_MARGIN_PX,
  BACKDROP_SHARD_GLINT_REACH_MAX_PX,
  BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MAX_MS,
  BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MIN_MS,
  BACKDROP_SHARD_TUMBLE_PERIOD_MAX_MS,
  BACKDROP_SHARD_COUNT,
  BACKDROP_SHARD_DEPTH_MAX,
  BACKDROP_SHARD_DEPTH_MIN,
  BACKDROP_SHARD_FLARE_FRACTION,
  BACKDROP_SHARD_BACKFACE_LIGHT,
  BACKDROP_SHARD_LIGHT_MIN,
  BACKDROP_STAR_COUNT,
} from '@helpers/config';
import {
  backdropColorShade,
  backdropShardFlare,
  backdropShardState,
  backdropShardTileUvs,
  backdropShardFacing,
  backdropShardFanIndices,
  backdropShardLight,
  backdropShardWrap,
  backdropShardsGenerate,
  backdropStarAlpha,
  backdropStarsGenerate,
} from '@helpers/pixi/pixi-backdrop-shards';
import type { BackdropShard } from '@interfaces';
import { describe, expect, it } from 'vitest';

const TAU = Math.PI * 2;
const PERIOD_MS = 1000;
const FLARE_MS = PERIOD_MS * BACKDROP_SHARD_FLARE_FRACTION;

function shardWith(overrides: Partial<BackdropShard> = {}): BackdropShard {
  return {
    fieldX: 0,
    fieldY: 0,
    depth: 0.5,
    sizePx: 10,
    vertices: [0, -1, 1, 1, -1, 1],
    color: 0xffffff,
    alpha: 0.6,
    hasHighlightEdge: false,
    glintReachPx: 10,
    periodMs: PERIOD_MS,
    phaseMs: 0,
    tumbleAxis: 0,
    tumblePhase: 0,
    tumbleSpeedPerMs: Math.PI / 1000,
    shimmerPhase: 0,
    floatPhaseX: 0,
    floatPhaseY: 0,
    floatSpeedX: 1,
    floatSpeedY: 1,
    floatAmplitudeX: 0,
    floatAmplitudeY: 0,
    wobbleAmplitude: 0,
    ...overrides,
  };
}

describe('backdropShardsGenerate', () => {
  it('is deterministic per seed', () => {
    expect(backdropShardsGenerate('a')).toEqual(backdropShardsGenerate('a'));
    expect(backdropShardsGenerate('a')).not.toEqual(
      backdropShardsGenerate('b'),
    );
  });

  it('orders far shards before near ones so near ones paint on top', () => {
    const depths = backdropShardsGenerate('a').map((shard) => shard.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it('gives only some shards a capped glint', () => {
    const reaches = backdropShardsGenerate('a').map(
      (shard) => shard.glintReachPx,
    );
    const glinting = reaches.filter((reach) => reach > 0);
    expect(glinting.length).toBeGreaterThan(0);
    expect(glinting.length).toBeLessThan(reaches.length / 2);
    glinting.forEach((reach) =>
      expect(reach).toBeLessThanOrEqual(BACKDROP_SHARD_GLINT_REACH_MAX_PX),
    );
  });

  it('mixes fast spinners in with the slow tumblers', () => {
    const speeds = backdropShardsGenerate('a').map((shard) =>
      Math.abs(shard.tumbleSpeedPerMs),
    );
    speeds.forEach((speed) => {
      expect(speed).toBeGreaterThanOrEqual(
        TAU / BACKDROP_SHARD_TUMBLE_PERIOD_MAX_MS,
      );
      expect(speed).toBeLessThanOrEqual(
        TAU / BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MIN_MS,
      );
    });
    const fastCount = speeds.filter(
      (speed) => speed >= TAU / BACKDROP_SHARD_FAST_TUMBLE_PERIOD_MAX_MS,
    ).length;
    expect(fastCount).toBeGreaterThan(0);
  });

  it('rolls triangles and quads within the configured depth range', () => {
    const shards = backdropShardsGenerate('a');
    expect(shards).toHaveLength(BACKDROP_SHARD_COUNT);
    shards.forEach((shard) => {
      expect([6, 8]).toContain(shard.vertices.length);
      expect(shard.depth).toBeGreaterThanOrEqual(BACKDROP_SHARD_DEPTH_MIN);
      expect(shard.depth).toBeLessThanOrEqual(BACKDROP_SHARD_DEPTH_MAX);
    });
  });
});

describe('backdropStarsGenerate', () => {
  it('is deterministic per seed', () => {
    const stars = backdropStarsGenerate('a');
    expect(stars).toHaveLength(BACKDROP_STAR_COUNT);
    expect(stars).toEqual(backdropStarsGenerate('a'));
  });
});

describe('backdropColorShade', () => {
  it('scales each channel and clamps at full brightness', () => {
    expect(backdropColorShade(0x804020, 0.5)).toBe(0x402010);
    expect(backdropColorShade(0xc08040, 2)).toBe(0xffff80);
  });
});

describe('backdropShardFlare', () => {
  it('peaks mid-window and rests outside it', () => {
    const shard = shardWith();
    expect(backdropShardFlare(shard, 0)).toBeCloseTo(0);
    expect(backdropShardFlare(shard, FLARE_MS / 2)).toBeCloseTo(1);
    expect(backdropShardFlare(shard, FLARE_MS + 1)).toBe(0);
    expect(backdropShardFlare(shard, PERIOD_MS + FLARE_MS / 2)).toBeCloseTo(1);
  });

  it('offsets the cycle by phase', () => {
    const shard = shardWith({ phaseMs: FLARE_MS / 2 });
    expect(backdropShardFlare(shard, 0)).toBeCloseTo(1);
  });
});

describe('backdropShardFacing', () => {
  it('turns from face-on through edge-on to the back face', () => {
    const shard = shardWith();
    expect(backdropShardFacing(shard, 0)).toBeCloseTo(1);
    expect(backdropShardFacing(shard, 500)).toBeCloseTo(0);
    expect(backdropShardFacing(shard, 1000)).toBeCloseTo(-1);
  });
});

describe('backdropShardLight', () => {
  it('dims edge-on and darkens the back face', () => {
    expect(backdropShardLight(1)).toBe(1);
    expect(backdropShardLight(0)).toBe(BACKDROP_SHARD_LIGHT_MIN);
    expect(backdropShardLight(-1)).toBeCloseTo(BACKDROP_SHARD_BACKFACE_LIGHT);
  });
});

describe('backdropShardState', () => {
  it('rests at its own alpha with no glint between flares', () => {
    const state = backdropShardState(shardWith(), PERIOD_MS - 1);
    expect(state.alpha).toBe(0.6);
    expect(state.glint).toBe(0);
    expect(state.shimmer).toBe(0);
  });

  it('never glints when the shard has no glint', () => {
    const state = backdropShardState(
      shardWith({ glintReachPx: 0 }),
      FLARE_MS / 2,
    );
    expect(state.alpha).toBeCloseTo(1);
    expect(state.glint).toBe(0);
  });

  it('is fully lit and glinting at the flare peak', () => {
    const state = backdropShardState(shardWith(), FLARE_MS / 2);
    expect(state.alpha).toBeCloseTo(1);
    expect(state.glint).toBeCloseTo(1);
  });

  it('drops the glare while edge-on', () => {
    const edgeOn = shardWith({ tumbleSpeedPerMs: 0, tumblePhase: Math.PI / 2 });
    expect(backdropShardState(edgeOn, FLARE_MS / 2).shimmer).toBeCloseTo(0);
  });
});

describe('backdropShardTileUvs', () => {
  it('fits the widest corner to the tile edge at a uniform scale', () => {
    expect(backdropShardTileUvs([0, -2, 1, 1, -1, 1])).toEqual([
      0.5, 0, 0.75, 0.75, 0.25, 0.75,
    ]);
  });
});

describe('backdropShardFanIndices', () => {
  it('fans triangles out from the first corner', () => {
    expect(backdropShardFanIndices(3)).toEqual([0, 1, 2]);
    expect(backdropShardFanIndices(4)).toEqual([0, 1, 2, 0, 2, 3]);
  });
});

describe('backdropStarAlpha', () => {
  it('pulses within a faint range', () => {
    const alphas = [0, 1000, 2000, 3000, 4000, 5000].map((ms) =>
      backdropStarAlpha({ fieldX: 0, fieldY: 0, radiusPx: 1, phase: 0 }, ms),
    );
    alphas.forEach((alpha) => {
      expect(alpha).toBeGreaterThanOrEqual(0.08);
      expect(alpha).toBeLessThanOrEqual(0.32);
    });
  });
});

describe('backdropShardWrap', () => {
  const margin = BACKDROP_FIELD_MARGIN_PX;

  it('drifts against the camera scaled by depth', () => {
    expect(backdropShardWrap(0.5, 0, 0.5, 100)).toBe(50);
    expect(backdropShardWrap(0.5, 40, 0.5, 100)).toBe(30);
  });

  it('re-enters from the opposite edge, including the margin', () => {
    expect(backdropShardWrap(0, 20, 1, 100)).toBe(100 + margin - 20);
    expect(backdropShardWrap(0.9, -40, 1, 100)).toBeCloseTo(
      0.9 * (100 + margin * 2) + 40 - (100 + margin * 2) - margin,
    );
  });
});

describe('backdropShardState under reduced motion', () => {
  const shard = shardWith({
    tumblePhase: 1,
    floatAmplitudeX: 10,
    floatAmplitudeY: 10,
    wobbleAmplitude: 0.1,
  });

  it('still twinkles and glints, but without growing', () => {
    const state = backdropShardState(shard, FLARE_MS / 2, true);
    expect(state.alpha).toBeCloseTo(1);
    expect(state.glint).toBeCloseTo(1);
    expect(state.scale).toBe(1);
    expect(state.glintScale).toBe(1);
  });

  it('holds position and angle still over time', () => {
    const early = backdropShardState(shard, 100, true);
    const late = backdropShardState(shard, 7300, true);
    expect(late.offsetX).toBe(early.offsetX);
    expect(late.offsetY).toBe(early.offsetY);
    expect(late.rotation).toBe(early.rotation);
    expect(late.facing).toBeCloseTo(Math.cos(1));
  });
});
