import { beforeEach, describe, expect, it } from 'vitest';

import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';
import { OUTPOST_TRAVEL_SPEED_BONUS_PER_LEVEL } from '@helpers/config';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { globalEffectSumsState, globalEffectsState } from '@helpers/state-game';
import {
  outpostBuffEffects,
  outpostBuffRefresh,
} from '@helpers/world-node/world-node-outpost-buff';
import type { GlobalEffectId } from '@interfaces';

const now = 500;
const buff = ensureGlobalEffect({
  id: 'regional-outpost' as GlobalEffectId,
  name: 'Regional Outpost',
});

function seedOutpost(level: number, activeEffect = false): void {
  seedGamestate((state) => {
    state.clock.numTicks = now;
    if (level > 0) state.outposts['Carrina Outpost'] = { level };
    if (activeEffect) {
      state.globalEffects = [{ ...buff, startTick: 0, expiresAtTick: 1000 }];
    }
  });
}

const refresh = (mapName: string) => inTick(() => outpostBuffRefresh(mapName));

beforeEach(() => {
  seedContent([buff]);
  seedWorldNodes([
    { name: 'Carrina Outpost', type: 'Outpost', mapName: 'Carrina' },
  ]);
});

describe('outpostBuffEffects', () => {
  it('scales on- and off-path travel speed by level', () => {
    const value = 3 * OUTPOST_TRAVEL_SPEED_BONUS_PER_LEVEL;
    expect(outpostBuffEffects(3)).toEqual([
      { effectType: 'GlobalOnPathTravelSpeedBoost', value },
      { effectType: 'GlobalOffPathTravelSpeedBoost', value },
    ]);
  });
});

describe('outpostBuffRefresh', () => {
  it('grants the buff on the outposts map, scaled by its level', () => {
    seedOutpost(2);

    refresh('Carrina');

    expect(globalEffectsState()).toEqual([
      expect.objectContaining({
        name: buff.name,
        startTick: now,
        effects: outpostBuffEffects(2),
        extendedDescription: expect.any(String),
      }),
    ]);
    expect(globalEffectSumsState().onPathTravelSpeedBonus).toBeCloseTo(
      2 * OUTPOST_TRAVEL_SPEED_BONUS_PER_LEVEL,
    );
  });

  it('drops the buff off the map or while the outpost is unbuilt', () => {
    seedOutpost(2, true);
    refresh('LarsianDesert');
    expect(globalEffectsState()).toEqual([]);

    seedOutpost(0, true);
    refresh('Carrina');
    expect(globalEffectsState()).toEqual([]);
  });
});
