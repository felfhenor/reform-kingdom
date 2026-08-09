import { describe, expect, it } from 'vitest';
import { weightedGridPathFind } from '@helpers/pathfinding-astar';

function uniformCostGrid(width: number, height: number, cost: number): number[][] {
  return Array.from({ length: height }, () => new Array(width).fill(cost));
}

describe('weightedGridPathFind', () => {
  it('finds a straight path across a uniform-cost open grid', () => {
    const costs = uniformCostGrid(5, 5, 1);

    expect(weightedGridPathFind(costs, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('routes around a tile with an infinite cost', () => {
    const costs = uniformCostGrid(3, 3, 1);
    costs[1][1] = Number.POSITIVE_INFINITY;

    const path = weightedGridPathFind(costs, { x: 0, y: 1 }, { x: 2, y: 1 });

    expect(path).not.toBeUndefined();
    expect(path?.some((point) => point.x === 1 && point.y === 1)).toBe(false);
  });

  it('returns undefined when no path exists', () => {
    const costs = uniformCostGrid(3, 3, 1);
    costs[0][1] = Number.POSITIVE_INFINITY;
    costs[1][1] = Number.POSITIVE_INFINITY;
    costs[2][1] = Number.POSITIVE_INFINITY;

    expect(weightedGridPathFind(costs, { x: 0, y: 1 }, { x: 2, y: 1 })).toBeUndefined();
  });

  it('returns undefined when the start or end tile is blocked', () => {
    const costs = uniformCostGrid(3, 3, 1);
    costs[0][0] = Number.POSITIVE_INFINITY;

    expect(weightedGridPathFind(costs, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeUndefined();
  });

  it('prefers a longer route through cheaper tiles over a shorter route through expensive ones', () => {
    // A cheap corridor runs along the top row; every other tile is expensive.
    // The direct diagonal-ish route is 4 Manhattan steps at cost 4 = 16.
    // The corridor route is 6 steps but costs 1 for 4 of them = 4 + 2*4 = 12.
    const costs = uniformCostGrid(5, 3, 4);
    costs[0][0] = 1;
    costs[0][1] = 1;
    costs[0][2] = 1;
    costs[0][3] = 1;
    costs[0][4] = 1;

    const path = weightedGridPathFind(costs, { x: 0, y: 0 }, { x: 4, y: 2 });

    expect(path).not.toBeUndefined();
    expect(path?.filter((point) => point.y === 0).length).toBeGreaterThan(1);
  });

  it('takes the direct route when off-road is cheap enough to not be worth detouring for', () => {
    const costs = uniformCostGrid(5, 3, 1);
    costs[0][0] = 1;
    costs[0][1] = 1;
    costs[0][2] = 1;
    costs[0][3] = 1;
    costs[0][4] = 1;

    const path = weightedGridPathFind(costs, { x: 0, y: 0 }, { x: 4, y: 2 });

    expect(path?.length).toBe(7);
  });
});
