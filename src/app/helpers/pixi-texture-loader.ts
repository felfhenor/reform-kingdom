import { tiledTilesetImagePath, tiledTileSourceRect } from '@helpers/tiled-map';
import type { TiledMap, TiledTileset } from '@interfaces';
import { Assets, Rectangle, Texture } from 'pixi.js';

export async function pixiTiledTilesetTexturesLoad(
  tileset: TiledTileset,
): Promise<Record<number, Texture>> {
  const baseTexture = await Assets.load(tiledTilesetImagePath(tileset));

  // Linear filtering (the default) samples across a tile's frame edge into
  // its neighbors in the shared atlas image, producing hairline seams
  // between adjacent tiles. Nearest-neighbor sampling keeps each tile's
  // pixels self-contained, which also suits this game's pixel art.
  baseTexture.source.scaleMode = 'nearest';

  const textures: Record<number, Texture> = {};

  for (let localId = 0; localId < tileset.tilecount; localId++) {
    const gid = tileset.firstgid + localId;
    const rect = tiledTileSourceRect(tileset, gid);

    textures[gid] = new Texture({
      source: baseTexture.source,
      frame: new Rectangle(rect.x, rect.y, rect.width, rect.height),
    });
  }

  return textures;
}

export async function pixiTiledMapTexturesLoad(
  map: TiledMap,
): Promise<Record<number, Texture>> {
  const textureSets = await Promise.all(
    map.tilesets.map((tileset) => pixiTiledTilesetTexturesLoad(tileset)),
  );

  return Object.assign({}, ...textureSets);
}

// Slices `frameCount` consecutive `frame`-sized frames (left to right, same
// row) out of a spritesheet image, matching the atlas layout convention
// `AtlasAnimationComponent` uses for CSS-driven job/hero animations - here
// used to build an `AnimatedSprite`'s texture frames instead.
export async function pixiSpriteFrameTexturesLoad(
  imageUrl: string,
  frame: { x: number; y: number; width: number; height: number },
  frameCount: number,
): Promise<Texture[]> {
  const baseTexture = await Assets.load(imageUrl);
  baseTexture.source.scaleMode = 'nearest';

  const textures: Texture[] = [];

  for (let i = 0; i < frameCount; i++) {
    textures.push(
      new Texture({
        source: baseTexture.source,
        frame: new Rectangle(
          frame.x + i * frame.width,
          frame.y,
          frame.width,
          frame.height,
        ),
      }),
    );
  }

  return textures;
}
