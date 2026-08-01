import { tiledTileSourceRect } from '@helpers/tiled-map';
import type { TiledMap, TiledTileset } from '@interfaces';
import { Assets, Rectangle, Texture } from 'pixi.js';

function tiledTilesetImagePath(tileset: TiledTileset): string {
  return tileset.image.replace(/^\.\.\//, '');
}

export async function pixiTiledTilesetTexturesLoad(
  tileset: TiledTileset,
): Promise<Record<number, Texture>> {
  const baseTexture = await Assets.load(tiledTilesetImagePath(tileset));
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
