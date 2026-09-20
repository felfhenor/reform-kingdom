import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel-cost', () => ({
  travelStepTicksCost: vi.fn(),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  tileIsOnPath: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeAt: vi.fn(),
}));

import { travelStepTicksCost } from '@helpers/hero/travel-cost';
import {
  travelPathAdvanceTick,
  travelStepUnitsCost,
  travelTicksRemaining,
  travelTicksToUnits,
  travelUnitsToTicks,
} from '@helpers/hero/travel-progress';
import type {
  CurrentLocation,
  PathAdvanceResult,
  TravelStep,
} from '@interfaces';

const origin: CurrentLocation = { mapName: 'Carrina', x: 0, y: 0 };

function moveSteps(count: number): TravelStep[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'Move' as const,
    mapName: 'Carrina',
    x: index + 1,
    y: 0,
  }));
}

function ticksToArrive(path: TravelStep[], maxTicks = 100): number {
  let remaining = path;
  let ticksIntoStep = 0;
  let location = origin;

  for (let tick = 1; tick <= maxTicks; tick++) {
    const result: PathAdvanceResult = travelPathAdvanceTick(
      remaining,
      ticksIntoStep,
      location,
    );
    if (result.arrived) return tick;

    remaining = result.path;
    ticksIntoStep = result.ticksIntoStep;
    location = result.location;
  }

  return maxTicks;
}

describe('travelTicksToUnits / travelUnitsToTicks', () => {
  it('scales ticks to whole sub-ticks', () => {
    expect(travelTicksToUnits(2.7)).toBe(270);
    expect(travelTicksToUnits(3)).toBe(300);
  });

  it('snaps float noise to the exact sub-tick', () => {
    expect(travelTicksToUnits(0.1 + 0.2)).toBe(30);
  });

  it('round-trips a saved progress value exactly', () => {
    expect(travelUnitsToTicks(travelTicksToUnits(0.3))).toBe(0.3);
    expect(travelUnitsToTicks(30)).toBe(0.3);
  });
});

describe('travelStepUnitsCost', () => {
  it('is the step tick cost in whole sub-ticks', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);

    expect(travelStepUnitsCost(moveSteps(1)[0], origin)).toBe(270);
  });

  it('is 0 for an instant step', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0);

    expect(travelStepUnitsCost(moveSteps(1)[0], origin)).toBe(0);
  });
});

describe('travelPathAdvanceTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(travelStepTicksCost).mockReturnValue(1);
  });

  it('is already arrived for an empty path', () => {
    expect(travelPathAdvanceTick([], 0, origin)).toEqual({
      arrived: true,
      location: origin,
    });
  });

  it('banks the tick without moving while the step is not yet covered', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(3);
    const path = moveSteps(2);

    expect(travelPathAdvanceTick(path, 1, origin)).toEqual({
      arrived: false,
      path,
      ticksIntoStep: 2,
      location: origin,
    });
  });

  it('completes the step and carries the exact surplus into the next one', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);
    const path = moveSteps(2);

    expect(travelPathAdvanceTick(path, 2, origin)).toEqual({
      arrived: false,
      path: [path[1]],
      ticksIntoStep: 0.3,
      location: { mapName: 'Carrina', x: 1, y: 0 },
    });
  });

  it('honors a fractional cost across a path: 10 steps at 2.7 ticks take 27 ticks, not 30', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);

    expect(ticksToArrive(moveSteps(10))).toBe(27);
  });

  it('spends a single tick across several sub-tick steps', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0.25);

    const result = travelPathAdvanceTick(moveSteps(6), 0, origin);

    expect(result).toEqual({
      arrived: false,
      path: moveSteps(6).slice(4),
      ticksIntoStep: 0,
      location: { mapName: 'Carrina', x: 4, y: 0 },
    });
  });

  it('chains an instant Teleport in the same tick as the step before it', () => {
    vi.mocked(travelStepTicksCost).mockImplementation((step) =>
      step.kind === 'Teleport' ? 0 : 1,
    );
    const path: TravelStep[] = [
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
    ];

    expect(travelPathAdvanceTick(path, 0, origin)).toEqual({
      arrived: true,
      location: { mapName: 'CraggledMire', x: 0, y: 0 },
    });
  });

  it('discards leftover progress on arrival', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0.25);

    expect(travelPathAdvanceTick(moveSteps(1), 0, origin).arrived).toBe(true);
  });

  it('matches whole-tick behavior exactly when every cost is an integer', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(3);

    expect(ticksToArrive(moveSteps(4))).toBe(12);
  });

  it('does not lose a tick to float error over many exactly-paid steps', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0.1);

    expect(ticksToArrive(moveSteps(10))).toBe(1);
  });

  it('carries a float-noisy cost without drift', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0.1 + 0.2);

    const result = travelPathAdvanceTick(moveSteps(4), 0, origin);

    expect(result.arrived).toBe(false);
    if (result.arrived) return;
    expect(result.ticksIntoStep).toBe(0.1);
    expect(result.path).toHaveLength(1);
  });
});

describe('travelTicksRemaining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rounds a fractional total up to the tick the party actually arrives on', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);

    expect(travelTicksRemaining(moveSteps(5), origin)).toBe(14);
  });

  it('subtracts progress already banked on the current step', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(3);

    expect(travelTicksRemaining(moveSteps(2), origin, 1)).toBe(5);
  });

  it('does not round an exact total up', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);

    expect(travelTicksRemaining(moveSteps(10), origin)).toBe(27);
  });

  it('is 0 for an empty path and never negative', () => {
    expect(travelTicksRemaining([], origin, 2)).toBe(0);
  });

  it('is at least 1 for a non-empty path, since even an all-Teleport path takes a tick', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0);

    expect(travelTicksRemaining(moveSteps(1), origin)).toBe(1);
  });

  it.each([0.25, 0.75, 0.95, 1, 1.25, 2.7, 3])(
    'agrees with the tick the engine actually arrives on for a %s-tick step',
    (cost) => {
      vi.mocked(travelStepTicksCost).mockReturnValue(cost);

      for (let count = 1; count <= 12; count++) {
        const path = moveSteps(count);
        expect(travelTicksRemaining(path, origin)).toBe(ticksToArrive(path));
      }
    },
  );
});
