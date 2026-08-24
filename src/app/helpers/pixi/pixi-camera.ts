import type { CameraBounds, CameraPosition, ViewportTiles } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

// Divides out zoom first (map is rendered at `zoom`x scale via `app.stage.scale`), so fewer tiles are visible at zoom > 1.
export function viewportTilesCalculate(
  screenWidth: number,
  screenHeight: number,
  zoom: number,
  tileWidth: number,
  tileHeight: number,
): ViewportTiles {
  return {
    widthTiles: screenWidth / zoom / tileWidth,
    heightTiles: screenHeight / zoom / tileHeight,
  };
}

// The map is rendered shifted half a tile up/left so a hero's tile-center lands at screen center, so
// bounds extend half a tile past each nominal edge to compensate. No correction when the map fits the viewport.
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

// Offset is relative to the hero-centered `base`, not absolute, so it stays valid as `base` shifts;
// clamping against `bounds - base` keeps `base + offset` inside the map bounds.
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
