import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel-cost', () => ({
  travelStepTicksCost: vi.fn(),
  travelPathTotalTicks: vi.fn(),
}));

import {
  travelPathTotalTicks,
  travelStepTicksCost,
} from '@helpers/hero/travel-cost';
import {
  travelPathAdvanceTick,
  travelProgressCovers,
  travelProgressSurplus,
  travelTicksRemaining,
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

describe('travelProgressCovers', () => {
  it('is always true for a zero-cost step', () => {
    expect(travelProgressCovers(0, 0)).toBe(true);
  });

  it('is true once progress reaches the cost, and false before', () => {
    expect(travelProgressCovers(2.69, 2.7)).toBe(false);
    expect(travelProgressCovers(2.7, 2.7)).toBe(true);
  });

  it('tolerates float error on an exactly-paid cost', () => {
    expect(travelProgressCovers(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe('travelProgressSurplus', () => {
  it('returns what is left after paying the cost', () => {
    expect(travelProgressSurplus(3, 2.7)).toBeCloseTo(0.3);
  });

  it('never goes negative when float error makes the cost marginally larger', () => {
    expect(travelProgressSurplus(0.3, 0.1 + 0.2)).toBe(0);
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

  it('completes the step and carries the surplus into the next one', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);
    const path = moveSteps(2);

    const result = travelPathAdvanceTick(path, 2, origin);

    expect(result.arrived).toBe(false);
    if (result.arrived) return;
    expect(result.path).toEqual([path[1]]);
    expect(result.location).toEqual({ mapName: 'Carrina', x: 1, y: 0 });
    expect(result.ticksIntoStep).toBeCloseTo(0.3);
  });

  it('honors a fractional cost across a path: 10 steps at 2.7 ticks take 27 ticks, not 30', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(2.7);

    expect(ticksToArrive(moveSteps(10))).toBe(27);
  });

  it('spends a single tick across several sub-tick steps', () => {
    vi.mocked(travelStepTicksCost).mockReturnValue(0.25);

    const result = travelPathAdvanceTick(moveSteps(6), 0, origin);

    expect(result.arrived).toBe(false);
    if (result.arrived) return;
    expect(result.location).toEqual({ mapName: 'Carrina', x: 4, y: 0 });
    expect(result.path).toHaveLength(2);
    expect(result.ticksIntoStep).toBeCloseTo(0);
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
});

describe('travelTicksRemaining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rounds a fractional total up to the tick the party actually arrives on', () => {
    vi.mocked(travelPathTotalTicks).mockReturnValue(13.5);

    expect(travelTicksRemaining(moveSteps(5), origin)).toBe(14);
  });

  it('subtracts progress already banked on the current step', () => {
    vi.mocked(travelPathTotalTicks).mockReturnValue(6);

    expect(travelTicksRemaining(moveSteps(2), origin, 1)).toBe(5);
  });

  it('does not round an exact total up because of float noise', () => {
    vi.mocked(travelPathTotalTicks).mockReturnValue(2.7 * 10);

    expect(travelTicksRemaining(moveSteps(10), origin)).toBe(27);
  });

  it('is 0 for an empty path and never negative', () => {
    vi.mocked(travelPathTotalTicks).mockReturnValue(0);

    expect(travelTicksRemaining([], origin, 2)).toBe(0);
  });

  it('is at least 1 for a non-empty path, since even an all-Teleport path takes a tick', () => {
    vi.mocked(travelPathTotalTicks).mockReturnValue(0);

    expect(travelTicksRemaining(moveSteps(1), origin)).toBe(1);
  });

  it.each([0.25, 0.75, 1, 1.25, 2.7, 3])(
    'agrees with the tick the engine actually arrives on for a %s-tick step',
    (cost) => {
      vi.mocked(travelStepTicksCost).mockReturnValue(cost);
      vi.mocked(travelPathTotalTicks).mockImplementation(
        (path) => path.length * cost,
      );

      for (let count = 1; count <= 12; count++) {
        const path = moveSteps(count);
        expect(travelTicksRemaining(path, origin)).toBe(ticksToArrive(path));
      }
    },
  );
});
