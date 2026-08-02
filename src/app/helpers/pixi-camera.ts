import type { CameraBounds, CameraPosition } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// The map (and everything positioned within it - see positionCamera's
// `centerOffset`) is rendered shifted half a tile up/left so a hero's
// tile-center, rather than its top-left corner, lands at screen center.
// That shift means the camera has to be able to travel half a tile past
// each nominal edge for the map's true edges to land exactly on the
// viewport's edges, rather than stopping half a tile short on one side and
// overshooting by half a tile on the other. There's nothing to correct for
// when the map is smaller than the viewport - the camera can't move at all.
export function cameraBoundsCalculate(
  viewportWidthTiles: number,
  viewportHeightTiles: number,
  mapWidthTiles: number,
  mapHeightTiles: number,
): CameraBounds {
  const rawMaxX = Math.max(0, mapWidthTiles - viewportWidthTiles);
  const rawMaxY = Math.max(0, mapHeightTiles - viewportHeightTiles);

  return {
    minX: rawMaxX > 0 ? -0.5 : 0,
    maxX: rawMaxX > 0 ? rawMaxX - 0.5 : 0,
    minY: rawMaxY > 0 ? -0.5 : 0,
    maxY: rawMaxY > 0 ? rawMaxY - 0.5 : 0,
  };
}

export function cameraPositionCalculate(
  playerX: number,
  playerY: number,
  viewportWidthTiles: number,
  viewportHeightTiles: number,
  mapWidthTiles: number,
  mapHeightTiles: number,
): CameraPosition {
  const bounds = cameraBoundsCalculate(
    viewportWidthTiles,
    viewportHeightTiles,
    mapWidthTiles,
    mapHeightTiles,
  );

  const x = clamp(playerX - viewportWidthTiles / 2, bounds.minX, bounds.maxX);
  const y = clamp(playerY - viewportHeightTiles / 2, bounds.minY, bounds.maxY);

  return { x, y };
}

// The offset is stored relative to the hero-centered `base` position rather
// than as an absolute camera position, so that it stays meaningful (and
// clamped) even as the base shifts - e.g. when the hero moves while the map
// is panned. Clamping against `bounds - base` keeps `base + offset` (the
// final camera position) inside the map bounds.
export function cameraOffsetFromDrag(
  currentOffset: CameraPosition,
  dragDeltaX: number,
  dragDeltaY: number,
  tileWidth: number,
  tileHeight: number,
  base: CameraPosition,
  bounds: CameraBounds,
): CameraPosition {
  return {
    x: clamp(
      currentOffset.x - dragDeltaX / tileWidth,
      bounds.minX - base.x,
      bounds.maxX - base.x,
    ),
    y: clamp(
      currentOffset.y - dragDeltaY / tileHeight,
      bounds.minY - base.y,
      bounds.maxY - base.y,
    ),
  };
}
