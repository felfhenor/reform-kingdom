import type { CameraPosition } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

export function cameraPositionCalculate(
  playerX: number,
  playerY: number,
  viewportWidthTiles: number,
  viewportHeightTiles: number,
  mapWidthTiles: number,
  mapHeightTiles: number,
): CameraPosition {
  const maxX = Math.max(0, mapWidthTiles - viewportWidthTiles);
  const maxY = Math.max(0, mapHeightTiles - viewportHeightTiles);

  const x = clamp(playerX - viewportWidthTiles / 2, 0, maxX);
  const y = clamp(playerY - viewportHeightTiles / 2, 0, maxY);

  return { x, y };
}
