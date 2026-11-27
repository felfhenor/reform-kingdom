import type { MapCoordinates, TiledMap } from '@interfaces';

export function mapCoordinatesAt(
  map: Pick<TiledMap, 'width' | 'height' | 'tilewidth' | 'tileheight'>,
  localX: number,
  localY: number,
): MapCoordinates | undefined {
  const tileX = Math.floor(localX / map.tilewidth);
  const tileY = Math.floor(localY / map.tileheight);
  const isOnMap =
    tileX >= 0 && tileY >= 0 && tileX < map.width && tileY < map.height;
  if (!isOnMap) return undefined;

  return {
    tileX,
    tileY,
    patchX: tileX * map.tilewidth,
    patchY: (tileY + 1) * map.tileheight,
  };
}
