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
