import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel', () => ({
  travelStepTicksCost: vi.fn(() => 3),
}));

import {
  defaultTravelGlideState,
  travelGlideAdvance,
} from '@helpers/pixi/pixi-travel-glide';
import type { CurrentLocation, TravelStep } from '@interfaces';

const START: CurrentLocation = { mapName: 'Carrina', x: 0, y: 0 };

describe('defaultTravelGlideState', () => {
  it('starts idle, visually parked at the given location', () => {
    const state = defaultTravelGlideState(START);

    expect(state.visual).toEqual(START);
    expect(state.hasActiveStep).toBe(false);
  });
});

describe('travelGlideAdvance', () => {
  it('snaps to the target when there is no in-flight step', () => {
    const glide = defaultTravelGlideState(START);
    const target: CurrentLocation = { mapName: 'Carrina', x: 5, y: 5 };

    const result = travelGlideAdvance(glide, target, undefined, 1000, 1);

    expect(result.visual).toEqual(target);
    expect(result.hasActiveStep).toBe(false);
  });

  it('snaps when the step is a Teleport (instant hop)', () => {
    const glide = defaultTravelGlideState(START);
    const target: CurrentLocation = { mapName: 'Carrina', x: 0, y: 0 };
    const step: TravelStep = { kind: 'Teleport', mapName: 'Craggledmire', x: 5, y: 5 };

    const result = travelGlideAdvance(glide, target, step, 1000, 1);

    expect(result.visual).toEqual(target);
    expect(result.hasActiveStep).toBe(false);
  });

  it('snaps on a map change rather than gliding across maps', () => {
    const glide = defaultTravelGlideState(START);
    const target: CurrentLocation = { mapName: 'Craggledmire', x: 0, y: 0 };
    const step: TravelStep = { kind: 'Move', mapName: 'Craggledmire', x: 1, y: 0 };

    const result = travelGlideAdvance(glide, target, step, 1000, 1);

    expect(result.visual).toEqual(target);
    expect(result.hasActiveStep).toBe(false);
  });

  it('begins gliding toward a new step, 0% progress at time 0', () => {
    const glide = defaultTravelGlideState(START);
    const step: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 };

    const result = travelGlideAdvance(glide, START, step, 0, 1);

    expect(result.hasActiveStep).toBe(true);
    expect(result.stepOrigin).toEqual(START);
    expect(result.stepDestination).toEqual({ mapName: 'Carrina', x: 1, y: 0 });
    // travelStepTicksCost is mocked to 3 ticks -> 3000ms at 1x speed.
    expect(result.stepDurationMs).toBe(3000);
    expect(result.visual).toEqual(START);
  });

  it('interpolates position partway through the step duration', () => {
    const glide = defaultTravelGlideState(START);
    const step: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 };

    const started = travelGlideAdvance(glide, START, step, 0, 1);
    // Halfway through the 3000ms duration.
    const midway = travelGlideAdvance(started, START, step, 1500, 1);

    expect(midway.visual.x).toBeCloseTo(0.5);
    expect(midway.visual.y).toBe(0);
  });

  it('reaches the destination once the step duration elapses', () => {
    const glide = defaultTravelGlideState(START);
    const step: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 };

    const started = travelGlideAdvance(glide, START, step, 0, 1);
    const finished = travelGlideAdvance(started, START, step, 3000, 1);

    expect(finished.visual).toEqual({ mapName: 'Carrina', x: 1, y: 0 });
  });

  it('does not overshoot past the destination if called late', () => {
    const glide = defaultTravelGlideState(START);
    const step: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 };

    const started = travelGlideAdvance(glide, START, step, 0, 1);
    const overdue = travelGlideAdvance(started, START, step, 10000, 1);

    expect(overdue.visual).toEqual({ mapName: 'Carrina', x: 1, y: 0 });
  });

  it('re-anchors the origin to the current visual position when the destination changes mid-glide', () => {
    const glide = defaultTravelGlideState(START);
    const firstStep: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 };

    const started = travelGlideAdvance(glide, START, firstStep, 0, 1);
    const midway = travelGlideAdvance(started, START, firstStep, 1500, 1);

    const secondStep: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 1 };
    const target: CurrentLocation = { mapName: 'Carrina', x: 1, y: 0 };
    const redirected = travelGlideAdvance(midway, target, secondStep, 1500, 1);

    // Origin is wherever the token visually was, not the tick-driven target -
    // avoids a visible snap on step handoff.
    expect(redirected.stepOrigin.x).toBeCloseTo(0.5);
    expect(redirected.stepDestination).toEqual({ mapName: 'Carrina', x: 1, y: 1 });
  });

  it('scales step duration down as the speed multiplier increases', () => {
    const glide = defaultTravelGlideState(START);
    const step: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 };

    const result = travelGlideAdvance(glide, START, step, 0, 3);

    // 3 ticks at 3x speed -> 1000ms instead of 3000ms.
    expect(result.stepDurationMs).toBe(1000);
  });
});
