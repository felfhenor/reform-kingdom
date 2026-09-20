import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/global-effects', () => ({
  globalEffectSums: vi.fn(() => ({
    offPathTravelSpeedBonus: 0,
    onPathTravelSpeedBonus: 0,
  })),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  tileIsOnPath: vi.fn(() => false),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(() => undefined),
}));

import { globalEffectSums } from '@helpers/hero/global-effects';
import {
  travelPathTotalTicks,
  travelStepTicksCost,
} from '@helpers/hero/travel-cost';
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

describe('travelStepTicksCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0,
      onPathTravelSpeedBonus: 0,
    } as never);
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(worldNodeAt).mockReturnValue(undefined);
  });

  it('is instant for a teleport step', () => {
    expect(
      travelStepTicksCost(
        { kind: 'Teleport', mapName: 'Carrina', x: 1, y: 1 },
        origin,
      ),
    ).toBe(0);
  });

  it('costs 1 tick entering an on-path tile', () => {
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCost(offPathStep, origin)).toBe(1);
  });

  it('costs 1 tick leaving a node tile, even onto an off-path tile', () => {
    vi.mocked(worldNodeAt).mockImplementation((_mapName, x, y) =>
      x === origin.x && y === origin.y ? ({} as WorldNodeEntry) : undefined,
    );
    expect(travelStepTicksCost(offPathStep, origin)).toBe(1);
  });

  it('costs 3 ticks entering an off-path tile with no boost active', () => {
    expect(travelStepTicksCost(offPathStep, origin)).toBe(3);
  });

  it('never applies the off-path boost to on-path movement', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0.5,
      onPathTravelSpeedBonus: 0,
    } as never);
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCost(offPathStep, origin)).toBe(1);
  });

  it('reduces the off-path cost proportionally, without rounding to a whole tick', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0.1,
      onPathTravelSpeedBonus: 0,
    } as never);
    expect(travelStepTicksCost(offPathStep, origin)).toBeCloseTo(2.7);
  });

  it('never reduces off-path travel below the on-path cost (+TICKS_PER_STEP_MIN_DIFF), even with an extreme boost', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 5,
      onPathTravelSpeedBonus: 0,
    } as never);
    expect(travelStepTicksCost(offPathStep, origin)).toBe(1.25);
  });

  it('ignores every active boost when asked for the unboosted cost', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0.5,
      onPathTravelSpeedBonus: 0.5,
    } as never);

    expect(travelStepTicksCost(offPathStep, origin, false)).toBe(3);

    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCost(offPathStep, origin, false)).toBe(1);
  });

  it('never applies the on-path boost to off-path movement', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0,
      onPathTravelSpeedBonus: 0.5,
    } as never);
    expect(travelStepTicksCost(offPathStep, origin)).toBe(3);
  });

  it('reduces the on-path cost proportionally, so even a small boost has an effect', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0,
      onPathTravelSpeedBonus: 0.05,
    } as never);
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCost(offPathStep, origin)).toBeCloseTo(0.95);
  });

  it('clamps the on-path cost to TICKS_PER_STEP_MIN_DIFF once the boost passes 75%', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0,
      onPathTravelSpeedBonus: 0.9,
    } as never);
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCost(offPathStep, origin)).toBe(0.25);
  });

  it('never reduces the on-path cost below TICKS_PER_STEP_MIN_DIFF, even with an extreme boost', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0,
      onPathTravelSpeedBonus: 5,
    } as never);
    vi.mocked(tileIsOnPath).mockReturnValue(true);
    expect(travelStepTicksCost(offPathStep, origin)).toBe(0.25);
  });
});

describe('travelPathTotalTicks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tileIsOnPath).mockReturnValue(false);
    vi.mocked(worldNodeAt).mockReturnValue(undefined);
  });

  it('sums each step, applying an active off-path speed boost to every off-path step', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0.5,
    } as never);
    const path: TravelStep[] = [
      offPathStep,
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ];

    // 2 off-path steps at the reduced 1.5 ticks each = 3
    expect(travelPathTotalTicks(path, origin)).toBe(3);
  });

  it('sums the base cost when unboosted, so stamina gates do not swing with a timed buff', () => {
    vi.mocked(globalEffectSums).mockReturnValue({
      offPathTravelSpeedBonus: 0.5,
    } as never);
    const path: TravelStep[] = [
      offPathStep,
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ];

    expect(travelPathTotalTicks(path, origin, false)).toBe(6);
  });
});
