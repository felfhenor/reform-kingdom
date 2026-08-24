import {
  tiledTilesetImagePath,
  tiledTileSourceRect,
} from '@helpers/pixi/tiled-map';
import type { TiledMap, TiledTileset } from '@interfaces';
import { Assets, Rectangle, Texture } from 'pixi.js';

export async function pixiTiledTilesetTexturesLoad(
  tileset: TiledTileset,
): Promise<Record<number, Texture>> {
  const baseTexture = await Assets.load(tiledTilesetImagePath(tileset));

  // Nearest-neighbor avoids hairline seams from linear filtering sampling across tile edges in the atlas.
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

// Slices consecutive same-row frames out of a spritesheet, matching AtlasAnimationComponent's layout convention.
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
