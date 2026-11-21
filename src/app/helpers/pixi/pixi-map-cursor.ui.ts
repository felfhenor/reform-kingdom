import { ffNearestInDirection } from '@ff/input/ff-spatial-nav';
import type { FFDirection, FFRect } from '@ff/interfaces/ff-input';
import type { CameraPosition, MapCursorNode } from '@interfaces';
import { clamp, minBy } from 'es-toolkit/compat';

export function mapCursorMove(
  cursor: CameraPosition,
  stick: CameraPosition,
  deltaMs: number,
  tilesPerSecond: number,
  mapSize: CameraPosition,
): CameraPosition {
  const step = (tilesPerSecond * deltaMs) / 1000;
  return {
    x: clamp(cursor.x + stick.x * step, 0, mapSize.x - 1),
    y: clamp(cursor.y + stick.y * step, 0, mapSize.y - 1),
  };
}

// The node the reticle snaps to: the closest one within reach of the cursor.
export function mapCursorTarget(
  cursor: CameraPosition,
  nodes: MapCursorNode[],
  reachTiles: number,
): MapCursorNode | undefined {
  const inReach = nodes.filter(
    (node) =>
      Math.hypot(node.x - cursor.x, node.y - cursor.y) <=
      (node.reachTiles ?? reachTiles),
  );
  return minBy(inReach, (node) =>
    Math.hypot(node.x - cursor.x, node.y - cursor.y),
  );
}

// Spatial nav works in pixels (its edge tolerance is pixel-sized), so tiles are scaled up first.
function mapCursorRect(point: CameraPosition, tileSize: number): FFRect {
  const x = point.x * tileSize;
  const y = point.y * tileSize;
  return { left: x, top: y, right: x, bottom: y };
}

// Points on the same row/column would count as "ahead" to spatial nav, so only strictly-beyond nodes are offered.
function mapCursorIsAhead(
  from: CameraPosition,
  node: CameraPosition,
  direction: FFDirection,
): boolean {
  if (direction === 'up') return node.y < from.y;
  if (direction === 'down') return node.y > from.y;
  if (direction === 'left') return node.x < from.x;
  return node.x > from.x;
}

export function mapCursorJump(
  from: CameraPosition,
  nodes: MapCursorNode[],
  direction: FFDirection,
  tileSize: number,
): MapCursorNode | undefined {
  const ahead = nodes.filter((node) => mapCursorIsAhead(from, node, direction));
  const index = ffNearestInDirection(
    mapCursorRect(from, tileSize),
    ahead.map((node) => mapCursorRect(node, tileSize)),
    direction,
  );
  return index === -1 ? undefined : ahead[index];
}
