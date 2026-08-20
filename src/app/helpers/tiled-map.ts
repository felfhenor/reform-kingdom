import { cacheBustURL } from '@helpers/version';
import type {
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledObjectSpriteFrame,
  TiledTileset,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

// Tiled's gid flip flags occupy the top 3 bits of the stored gid, so a
// sprite lookup on a (potentially flipped) object gid needs them masked off
// first or it will never match a tileset's firstgid range.
const GID_FLIP_FLAGS_MASK = 0x1fffffff;

export function tiledMapTileLayers(map: TiledMap): TiledLayer[] {
  return map.layers.filter((layer) => layer.type === 'tilelayer');
}

export function tiledMapGetLayer(
  map: TiledMap,
  name: string,
): TiledLayer | undefined {
  return map.layers.find((layer) => layer.name === name);
}

export function tiledTilesetForGid(
  map: TiledMap,
  gid: number,
): TiledTileset | undefined {
  if (gid <= 0) return undefined;

  const candidates = map.tilesets.filter((tileset) => gid >= tileset.firstgid);
  if (candidates.length === 0) return undefined;

  return sortBy(candidates, (tileset) => tileset.firstgid).at(-1);
}

export function tiledTileSourceRect(
  tileset: TiledTileset,
  gid: number,
): { x: number; y: number; width: number; height: number } {
  const localId = gid - tileset.firstgid;
  const column = localId % tileset.columns;
  const row = Math.floor(localId / tileset.columns);

  return {
    x: tileset.margin + column * (tileset.tilewidth + tileset.spacing),
    y: tileset.margin + row * (tileset.tileheight + tileset.spacing),
    width: tileset.tilewidth,
    height: tileset.tileheight,
  };
}

export function tiledLayerTileAt(layer: TiledLayer, x: number, y: number): number {
  if (!layer.data || !layer.width) return 0;

  return layer.data[y * layer.width + x] ?? 0;
}

export function tiledTilesetImagePath(tileset: TiledTileset): string {
  return cacheBustURL(tileset.image.replace(/^\.\.\//, ''));
}

export function tiledObjectProperty<T>(
  object: TiledObject,
  name: string,
): T | undefined {
  return object.properties?.find((property) => property.name === name)
    ?.value as T | undefined;
}

export function tiledObjectSpriteFrame(
  map: TiledMap,
  object: TiledObject,
): TiledObjectSpriteFrame | undefined {
  if (!object.gid) return undefined;

  const gid = object.gid & GID_FLIP_FLAGS_MASK;
  const tileset = tiledTilesetForGid(map, gid);
  if (!tileset) return undefined;

  return {
    imagePath: tiledTilesetImagePath(tileset),
    imageWidth: tileset.imagewidth,
    imageHeight: tileset.imageheight,
    ...tiledTileSourceRect(tileset, gid),
  };
}
