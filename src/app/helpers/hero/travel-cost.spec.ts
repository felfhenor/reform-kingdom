import { beforeEach, describe, expect, it } from 'vitest';

import {
  travelPathTotalTicks,
  travelStepTicksCost,
} from '@helpers/hero/travel-cost';
import {
  travelStepBaseTicksCost,
  travelStepTicksCostWithBonus,
} from '@helpers/hero/travel-cost-base';
import type { CurrentLocation, TravelStep } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const origin: CurrentLocation = { mapName: 'Carrina', x: 0, y: 0 };
// Lands on a node tile, so it costs the on-path rate.
const onPathStep: TravelStep = { kind: 'Move', mapName: 'Carrina', x: 5, y: 5 };
const offPathStep: TravelStep = {
  kind: 'Move',
  mapName: 'Carrina',
  x: 1,
  y: 0,
};

beforeEach(() => {
  seedWorldNodes([
    {
      name: 'Field Ruins',
      type: 'ExploreNode',
      mapName: 'Carrina',
      x: 5,
      y: 5,
    },
  ]);
});

describe('travelStepTicksCost / travelPathTotalTicks', () => {
  it('feeds the live on-path and off-path bonuses into the step cost', () => {
    seedGamestate((state) => {
      state.globalEffectSums.onPathTravelSpeedBonus = 0.25;
      state.globalEffectSums.offPathTravelSpeedBonus = 0.5;
    });
    const boosted = (step: TravelStep) =>
      travelStepTicksCostWithBonus(step, origin, 0.25, 0.5);

    [onPathStep, offPathStep].forEach((step) => {
      expect(boosted(step)).toBeLessThan(travelStepBaseTicksCost(step, origin));
      expect(travelStepTicksCost(step, origin)).toBe(boosted(step));
    });
    expect(travelPathTotalTicks([offPathStep, offPathStep], origin)).toBe(
      boosted(offPathStep) * 2,
    );
  });

  it('matches the base cost with no bonus active', () => {
    seedGamestate();

    expect(travelStepTicksCost(offPathStep, origin)).toBe(
      travelStepBaseTicksCost(offPathStep, origin),
    );
  });
});
