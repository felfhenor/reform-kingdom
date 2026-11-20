import { ffNearestInDirection, ffNearestTo } from '@ff/input/ff-spatial-nav';
import type { FFRect } from '@ff/interfaces/ff-input';
import { describe, expect, it } from 'vitest';

function rect(left: number, top: number, width = 64, height = 64): FFRect {
  return { left, top, right: left + width, bottom: top + height };
}

describe('ffNearestInDirection', () => {
  const grid = [
    rect(0, 0),
    rect(80, 0),
    rect(160, 0),
    rect(0, 80),
    rect(80, 80),
  ];

  it('moves along a grid row and column', () => {
    expect(ffNearestInDirection(grid[0], grid, 'right')).toBe(1);
    expect(ffNearestInDirection(grid[0], grid, 'down')).toBe(3);
    expect(ffNearestInDirection(grid[4], grid, 'up')).toBe(1);
    expect(ffNearestInDirection(grid[4], grid, 'left')).toBe(3);
  });

  it('prefers the same row over a closer diagonal', () => {
    const from = rect(0, 100);
    const sameRow = rect(120, 100);
    const diagonal = rect(80, 0);
    expect(ffNearestInDirection(from, [diagonal, sameRow], 'right')).toBe(1);
  });

  it('ignores candidates that overlap the current element on that axis', () => {
    const sideRailItem = rect(0, 300, 200, 32);
    const navbarTab = rect(100, 0, 80, 32);
    const content = rect(240, 600);
    expect(
      ffNearestInDirection(sideRailItem, [navbarTab, content], 'right'),
    ).toBe(1);
  });

  it('returns -1 at an edge', () => {
    expect(ffNearestInDirection(grid[2], grid, 'right')).toBe(-1);
  });
});

describe('ffNearestTo', () => {
  it('picks the closest candidate in any direction', () => {
    const lost = rect(1000, 100, 100, 32);
    const rail = rect(0, 100, 40, 40);
    const listRow = rect(100, 140, 280, 60);
    expect(ffNearestTo(lost, [rail, listRow])).toBe(1);
  });

  it('returns -1 with no candidates', () => {
    expect(ffNearestTo(rect(0, 0), [])).toBe(-1);
  });
});
