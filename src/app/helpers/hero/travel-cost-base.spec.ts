import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  tileIsOnPath: vi.fn(() => false),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(() => undefined),
}));

import {
  travelPathBaseTotalTicks,
  travelPathSumTicks,
  travelStepBaseTicksCost,
  travelStepTicksCostWithBonus,
} from '@helpers/hero/travel-cost-base';
import { tileIsOnPath } from '@helpers/pathfinding/pathfinding';
import { worldNodeAt } from '@helpers/world-node/world-nodes';
import type { CurrentLocation, TravelStep, WorldNodeEntry } from '@interfaces';

const origin: CurrentLocation = { mapName: 'Carrina', x: 0, y: 0 };
const offPathStep: TravelStep = {
  kind: 'Move',
  mapName: 'Carrina',
  x: 1,
  y: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tileIsOnPath).mockReturnValue(false);
  vi.mocked(worldNodeAt).mockReturnValue(undefined);
});

describe('travelStepBaseTicksCost', () => {
  it('is instant for a teleport step', () => {
    expect(
      travelStepBaseTicksCost(
        { kind: 'Teleport', mapName: 'Carrina', x: 1, y: 1 },
        origin,
      ),
    ).toBe(0);
  });

  it('costs 1 tick entering an on-path tile', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepBaseTicksCost(offPathStep, origin)).toBe(1);
  });

  it('costs 1 tick entering a node tile that is not on a path', () => {
    vi.mocked(worldNodeAt).mockImplementation((_mapName, x) =>
      x === offPathStep.x ? ({} as WorldNodeEntry) : undefined,
    );
    expect(travelStepBaseTicksCost(offPathStep, origin)).toBe(1);
  });

  it('costs 1 tick leaving a node tile, even onto an off-path tile', () => {
    vi.mocked(worldNodeAt).mockImplementation((_mapName, x, y) =>
      x === origin.x && y === origin.y ? ({} as WorldNodeEntry) : undefined,
    );
    expect(travelStepBaseTicksCost(offPathStep, origin)).toBe(1);
  });

  it('costs 3 ticks entering an off-path tile', () => {
    expect(travelStepBaseTicksCost(offPathStep, origin)).toBe(3);
  });
});

describe('travelStepTicksCostWithBonus', () => {
  it('reduces the off-path cost by the off-path bonus only', () => {
    expect(
      travelStepTicksCostWithBonus(offPathStep, origin, 0.5, 0.1),
    ).toBeCloseTo(2.7);
  });

  it('reduces the on-path cost by the on-path bonus only', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(
      travelStepTicksCostWithBonus(offPathStep, origin, 0.05, 0.5),
    ).toBeCloseTo(0.95);
  });

  it('never drops off-path travel below the on-path cost plus the min diff', () => {
    expect(travelStepTicksCostWithBonus(offPathStep, origin, 0, 5)).toBe(1.25);
  });

  it('never drops on-path travel below the min diff', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCostWithBonus(offPathStep, origin, 5, 0)).toBe(0.25);
  });
});

describe('travelPathSumTicks', () => {
  it('threads each completed step in as the next origin', () => {
    const path: TravelStep[] = [
      offPathStep,
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ];
    const origins: CurrentLocation[] = [];

    travelPathSumTicks(path, origin, (_step, originTile) => {
      origins.push(originTile);
      return 1;
    });

    expect(origins).toEqual([origin, { mapName: 'Carrina', x: 1, y: 0 }]);
  });

  it('is zero for an empty path', () => {
    expect(travelPathSumTicks([], origin, () => 9)).toBe(0);
  });
});

describe('travelPathBaseTotalTicks', () => {
  it('sums the unboosted cost of every step', () => {
    const path: TravelStep[] = [
      offPathStep,
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ];

    expect(travelPathBaseTotalTicks(path, origin)).toBe(6);
  });
});
