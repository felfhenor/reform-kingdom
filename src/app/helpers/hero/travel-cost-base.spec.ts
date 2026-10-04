import { beforeEach, describe, expect, it } from 'vitest';

import {
  TICKS_PER_STEP_MIN_DIFF,
  TICKS_PER_STEP_OFF_PATH,
  TICKS_PER_STEP_ON_PATH,
} from '@helpers/config';
import {
  travelPathBaseTotalTicks,
  travelPathSumTicks,
  travelStepBaseTicksCost,
  travelStepTicksCostWithBonus,
} from '@helpers/hero/travel-cost-base';
import type { CurrentLocation, TravelStep } from '@interfaces';
import { locationOf, seedWorldNodes } from '@/testing/world';

const MAP = 'TestMap';
const at = (x: number, y = 0): CurrentLocation => ({ mapName: MAP, x, y });
const moveTo = (x: number, y = 0): TravelStep => ({
  kind: 'Move',
  ...at(x, y),
});

let nodeTile: CurrentLocation;

// Open ground, a path tile at x=5, and a node somewhere off the path.
beforeEach(() => {
  const { Ruins } = seedWorldNodes(
    [{ name: 'Ruins', type: 'ExploreNode', x: 8, y: 3 }],
    [{ x: 5, y: 0 }],
  );
  nodeTile = locationOf(Ruins);
});

const offPath = moveTo(1);
const onPath = moveTo(5);

describe('travelStepBaseTicksCost', () => {
  it('is instant for a teleport step', () => {
    expect(
      travelStepBaseTicksCost({ kind: 'Teleport', ...at(1, 1) }, at(0)),
    ).toBe(0);
  });

  it('charges the on-path cost entering a path or node tile, or leaving a node tile', () => {
    expect(travelStepBaseTicksCost(onPath, at(4))).toBe(TICKS_PER_STEP_ON_PATH);
    expect(travelStepBaseTicksCost({ kind: 'Move', ...nodeTile }, at(0))).toBe(
      TICKS_PER_STEP_ON_PATH,
    );
    expect(travelStepBaseTicksCost(offPath, nodeTile)).toBe(
      TICKS_PER_STEP_ON_PATH,
    );
  });

  it('charges the off-path cost entering open ground, even from a path tile', () => {
    expect(travelStepBaseTicksCost(offPath, at(0))).toBe(
      TICKS_PER_STEP_OFF_PATH,
    );
    expect(travelStepBaseTicksCost(moveTo(6), at(5))).toBe(
      TICKS_PER_STEP_OFF_PATH,
    );
  });
});

describe('travelStepTicksCostWithBonus', () => {
  it('applies the off-path bonus off the path and the on-path bonus on it', () => {
    expect(travelStepTicksCostWithBonus(offPath, at(0), 0.5, 0.1)).toBeCloseTo(
      TICKS_PER_STEP_OFF_PATH * 0.9,
    );
    expect(travelStepTicksCostWithBonus(onPath, at(4), 0.05, 0.5)).toBeCloseTo(
      TICKS_PER_STEP_ON_PATH * 0.95,
    );
  });

  it('keeps off-path travel above on-path travel, and both above zero', () => {
    expect(travelStepTicksCostWithBonus(offPath, at(0), 0, 5)).toBe(
      TICKS_PER_STEP_ON_PATH + TICKS_PER_STEP_MIN_DIFF,
    );
    expect(travelStepTicksCostWithBonus(onPath, at(4), 5, 0)).toBe(
      TICKS_PER_STEP_MIN_DIFF,
    );
  });
});

describe('travelPathSumTicks', () => {
  it('threads each completed step in as the next origin', () => {
    const origins: CurrentLocation[] = [];

    travelPathSumTicks([offPath, moveTo(2)], at(0), (_step, originTile) => {
      origins.push(originTile);
      return 1;
    });

    expect(origins).toEqual([at(0), at(1)]);
  });

  it('is zero for an empty path', () => {
    expect(travelPathSumTicks([], at(0), () => 9)).toBe(0);
  });
});

describe('travelPathBaseTotalTicks', () => {
  it('sums the unboosted cost of every step', () => {
    expect(travelPathBaseTotalTicks([offPath, moveTo(2)], at(0))).toBe(
      TICKS_PER_STEP_OFF_PATH * 2,
    );
  });
});
