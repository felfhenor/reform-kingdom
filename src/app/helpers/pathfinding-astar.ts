import { minBy } from 'es-toolkit/compat';

// 4-directional neighbor offsets - diagonal movement isn't supported, matching
// this game's tile-based movement.
const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function tileIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

function manhattanDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// The heuristic must never overestimate the true remaining cost, so it's
// scaled by the cheapest possible per-tile cost on the grid rather than a
// flat 1.
function cheapestMoveCost(costs: number[][]): number {
  return Math.min(...costs.flatMap((row) => row.filter((cost) => Number.isFinite(cost))));
}

function cheapestOpenNode(
  open: Map<number, { x: number; y: number }>,
  gScore: Map<number, number>,
  end: { x: number; y: number },
  width: number,
  heuristicWeight: number,
): { x: number; y: number } {
  return minBy([...open.values()], (point) => {
    const gValue = gScore.get(tileIndex(point.x, point.y, width)) ?? Infinity;
    return gValue + manhattanDistance(point, end) * heuristicWeight;
  })!;
}

function inBoundsNeighbors(
  point: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number }[] {
  return NEIGHBOR_OFFSETS.map(([dx, dy]) => ({ x: point.x + dx, y: point.y + dy })).filter(
    (neighbor) =>
      neighbor.x >= 0 && neighbor.x < width && neighbor.y >= 0 && neighbor.y < height,
  );
}

function relaxNeighbor(
  current: { x: number; y: number },
  neighbor: { x: number; y: number },
  moveCost: number,
  width: number,
  gScore: Map<number, number>,
  cameFrom: Map<number, { x: number; y: number }>,
  open: Map<number, { x: number; y: number }>,
): void {
  const currentIndex = tileIndex(current.x, current.y, width);
  const neighborIndex = tileIndex(neighbor.x, neighbor.y, width);
  const tentativeG = (gScore.get(currentIndex) ?? Infinity) + moveCost;
  if (tentativeG >= (gScore.get(neighborIndex) ?? Infinity)) return;

  cameFrom.set(neighborIndex, current);
  gScore.set(neighborIndex, tentativeG);
  open.set(neighborIndex, neighbor);
}

function reconstructPath(
  cameFrom: Map<number, { x: number; y: number }>,
  end: { x: number; y: number },
  width: number,
): { x: number; y: number }[] {
  const path = [end];
  let currentIndex = tileIndex(end.x, end.y, width);

  while (cameFrom.has(currentIndex)) {
    const previous = cameFrom.get(currentIndex)!;
    path.unshift(previous);
    currentIndex = tileIndex(previous.x, previous.y, width);
  }

  return path;
}

/**
 * Finds the cheapest 4-directional route through `costs`, where
 * `costs[y][x]` is the price of stepping onto that tile and a non-finite
 * value marks it impassable. Unlike a plain walkable/blocked grid, tiles can
 * carry different costs - so a route that touches more, cheaper tiles can
 * beat a shorter route through expensive ones.
 *
 * Grids here are small (world maps top out around 50x50 tiles), so scanning
 * the open set for its cheapest node each iteration is fast enough without a
 * binary heap.
 */
export function weightedGridPathFind(
  costs: number[][],
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number }[] | undefined {
  const height = costs.length;
  const width = costs[0]?.length ?? 0;
  if (
    !Number.isFinite(costs[start.y]?.[start.x]) ||
    !Number.isFinite(costs[end.y]?.[end.x])
  ) {
    return undefined;
  }

  const heuristicWeight = cheapestMoveCost(costs);
  const startIndex = tileIndex(start.x, start.y, width);
  const gScore = new Map<number, number>([[startIndex, 0]]);
  const cameFrom = new Map<number, { x: number; y: number }>();
  const open = new Map<number, { x: number; y: number }>([[startIndex, start]]);
  const closed = new Set<number>();

  while (open.size > 0) {
    const current = cheapestOpenNode(open, gScore, end, width, heuristicWeight);
    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(cameFrom, current, width);
    }

    const currentIndex = tileIndex(current.x, current.y, width);
    open.delete(currentIndex);
    closed.add(currentIndex);

    inBoundsNeighbors(current, width, height)
      .filter((neighbor) => !closed.has(tileIndex(neighbor.x, neighbor.y, width)))
      .forEach((neighbor) => {
        const moveCost = costs[neighbor.y][neighbor.x];
        if (!Number.isFinite(moveCost)) return;

        relaxNeighbor(current, neighbor, moveCost, width, gScore, cameFrom, open);
      });
  }

  return undefined;
}
