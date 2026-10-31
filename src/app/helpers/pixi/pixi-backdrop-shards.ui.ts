import { BACKDROP_STAR_DEPTH } from '@helpers/config';
import { isMotionReduced } from '@helpers/engine/motion';
import {
  backdropColorShade,
  backdropShardFanIndices,
  backdropShardState,
  backdropShardTileUvs,
  backdropShardWrap,
  backdropShardsGenerate,
  backdropStarAlpha,
  backdropStarsGenerate,
} from '@helpers/pixi/pixi-backdrop-shards';
import { allMaps } from '@helpers/maps';
import { tiledMapHasGaps, tiledMapsNodeTileIds } from '@helpers/pixi/tiled-map';
import type { BackdropShard, BackdropUpdate, TiledMap } from '@interfaces';
import type { Texture } from 'pixi.js';
import {
  Container,
  FillGradient,
  Graphics,
  MeshSimple,
  RenderLayer,
} from 'pixi.js';

const MEMORY_TILESET_NAME = 'landmarks';

// Unit square, stretched to the viewport every frame.
function pixiBackdropBackgroundCreate(): Graphics {
  const gradient = new FillGradient({
    type: 'radial',
    center: { x: 0.48, y: 0.48 },
    innerRadius: 0,
    outerCenter: { x: 0.48, y: 0.48 },
    outerRadius: 0.85,
    colorStops: [
      { offset: 0, color: 0x34212f },
      { offset: 0.5, color: 0x241724 },
      { offset: 1, color: 0x120e19 },
    ],
    textureSpace: 'local',
  });
  return new Graphics().rect(0, 0, 1, 1).fill(gradient);
}

// Node art from every map, so any map's shards can recall places beyond it.
function pixiBackdropMemoryTextures(
  map: TiledMap,
  textures: Record<number, Texture>,
): Texture[] {
  const tileset = map.tilesets.find((t) => t.name === MEMORY_TILESET_NAME);
  if (!tileset) return [];

  const maps = [...allMaps().values()].map((entry) => entry.data as TiledMap);
  return tiledMapsNodeTileIds(maps, MEMORY_TILESET_NAME)
    .map((id) => textures[tileset.firstgid + id])
    .filter((texture): texture is Texture => !!texture);
}

// A mesh rather than a texture fill or mask: mesh uvs respect the tile's atlas frame and stay batched.
function pixiBackdropMemoryMeshCreate(
  shard: BackdropShard,
  points: number[],
  texture: Texture,
): MeshSimple {
  const mesh = new MeshSimple({
    texture,
    vertices: new Float32Array(points),
    uvs: new Float32Array(backdropShardTileUvs(shard.vertices)),
    indices: new Uint32Array(backdropShardFanIndices(points.length / 2)),
  });
  // Sepia-tinted so the recalled place reads as faded, not as a live node.
  mesh.tint = 0xd9c4bc;
  return mesh;
}

function pixiBackdropShardBodyCreate(
  shard: BackdropShard,
  memoryTexture?: Texture,
): { body: Container; flare: Graphics; memory?: MeshSimple } {
  const points = shard.vertices.map((value) => value * shard.sizePx);
  const body = new Container();
  body.addChild(new Graphics().poly(points).fill(shard.color));

  const memory = memoryTexture
    ? pixiBackdropMemoryMeshCreate(shard, points, memoryTexture)
    : undefined;
  if (memory) body.addChild(memory);

  const edges = new Graphics()
    .poly(points)
    .stroke({ color: 0xd2aeae, alpha: 0.1, width: 0.65 });
  if (shard.hasHighlightEdge) {
    edges
      .moveTo(points[0], points[1])
      .lineTo(points[2], points[3])
      .stroke({ color: 0xddae9d, alpha: 0.19, width: 0.8 });
  }
  const flare = new Graphics().poly(points).fill(0xf6e2cf);
  flare.blendMode = 'add';
  body.addChild(edges, flare);
  return { body, flare, memory };
}

function pixiBackdropGlintCreate(shard: BackdropShard): Graphics | undefined {
  const reach = shard.glintReachPx;
  if (reach <= 0) return undefined;

  const waist = reach * 0.08;
  const glint = new Graphics()
    .poly([0, -reach, waist, 0, 0, reach, -waist, 0])
    .poly([-reach, 0, 0, -waist, reach, 0, 0, waist])
    .fill(0xfff4d6);
  glint.blendMode = 'add';
  return glint;
}

function pixiBackdropShardSpritesCreate(
  container: Container,
  seed: string,
  memories: Texture[],
) {
  return backdropShardsGenerate(seed).map((shard) => {
    const root = new Container();
    const memoryTexture =
      shard.memoryPick === undefined
        ? undefined
        : memories[Math.floor(shard.memoryPick * memories.length)];
    const { body, flare, memory } = pixiBackdropShardBodyCreate(
      shard,
      memoryTexture,
    );
    // Squashing this frame along its rotated x-axis fakes the shard turning in depth about that axis.
    const tilt = new Container();
    tilt.rotation = shard.tumbleAxis;
    tilt.addChild(body);
    const glint = pixiBackdropGlintCreate(shard);
    root.addChild(tilt);
    if (glint) root.addChild(glint);
    container.addChild(root);
    return { shard, root, tilt, body, flare, memory, glint };
  });
}

function pixiBackdropStarSpritesCreate(container: Container, seed: string) {
  return backdropStarsGenerate(seed).map((star) => {
    const sprite = new Graphics().circle(0, 0, star.radiusPx).fill(0xd5b9c5);
    container.addChild(sprite);
    return { star, sprite };
  });
}

// Undefined for maps with no tile gaps, since the backdrop would be fully covered there.
export function pixiBackdropShardsCreate(
  map: TiledMap,
  seed: string,
  textures: Record<number, Texture>,
): { container: Container; update: BackdropUpdate } | undefined {
  if (!tiledMapHasGaps(map)) return undefined;

  const container = new Container();
  container.eventMode = 'none';
  // Its own render group, so backdrop changes never force a rebuild of the map's render instructions.
  container.isRenderGroup = true;
  const background = pixiBackdropBackgroundCreate();
  container.addChild(background);
  const stars = pixiBackdropStarSpritesCreate(container, seed);
  const shards = pixiBackdropShardSpritesCreate(
    container,
    seed,
    pixiBackdropMemoryTextures(map, textures),
  );
  // All additive glows draw last as one batch instead of breaking the batch twice per shard.
  const glowLayer = new RenderLayer();
  container.addChild(glowLayer);
  shards.forEach(({ flare, glint }) =>
    glowLayer.attach(...(glint ? [flare, glint] : [flare])),
  );

  const update: BackdropUpdate = (nowMs, cameraPx, viewWidth, viewHeight) => {
    const isReduced = isMotionReduced();
    // Reduced motion moves every layer rigidly with the map, so nothing slides at its own speed.
    const depthFor = (depth: number) => (isReduced ? 1 : depth);
    const starDepth = depthFor(BACKDROP_STAR_DEPTH);
    background.scale.set(viewWidth, viewHeight);

    stars.forEach(({ star, sprite }) => {
      sprite.position.set(
        backdropShardWrap(star.fieldX, cameraPx.x, starDepth, viewWidth),
        backdropShardWrap(star.fieldY, cameraPx.y, starDepth, viewHeight),
      );
      sprite.alpha = backdropStarAlpha(star, nowMs);
    });

    shards.forEach(({ shard, root, tilt, body, flare, memory, glint }) => {
      const state = backdropShardState(shard, nowMs, isReduced);
      const depth = depthFor(shard.depth);
      root.position.set(
        backdropShardWrap(shard.fieldX, cameraPx.x, depth, viewWidth) +
          state.offsetX,
        backdropShardWrap(shard.fieldY, cameraPx.y, depth, viewHeight) +
          state.offsetY,
      );
      tilt.scale.set(state.facing * state.scale, state.scale);
      body.rotation = state.rotation - shard.tumbleAxis;
      body.alpha = state.alpha;
      body.tint = backdropColorShade(0xffffff, state.light);
      // The memory is etched on the front face only; alpha rather than visible avoids a render-group rebuild per flip.
      if (memory) memory.alpha = state.facing > 0 ? 0.85 : 0;
      flare.alpha = state.shimmer * 0.4;
      if (glint) {
        glint.alpha = state.glint;
        glint.scale.set(state.glintScale);
      }
    });
  };

  return { container, update };
}
