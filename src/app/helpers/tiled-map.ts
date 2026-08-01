import type { TiledLayer, TiledMap, TiledTileset } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

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
