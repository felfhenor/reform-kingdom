import { describe, expect, it } from 'vitest';

import { worldTownsState } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type { TownId, TownNodeState } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { inTick, seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;

function seedTown(
  numTicks: number,
  lastProcessedTick?: TownNodeState['lastProcessedTick'],
): void {
  seedGamestate((state) => {
    state.clock.numTicks = numTicks;
    if (lastProcessedTick) {
      state.world.towns[townId] = buildTownNodeState({ lastProcessedTick });
    }
  });
}

describe('isTownDueForUpdate', () => {
  it('is due once the interval has passed since that subsystem last ran', () => {
    seedTown(1000, { worker: 900 });

    expect(isTownDueForUpdate(townId, 'worker', 101)).toBe(false);
    expect(isTownDueForUpdate(townId, 'worker', 100)).toBe(true);
    expect(isTownDueForUpdate(townId, 'raid', 1000)).toBe(true);
  });

  it('is never due for a town never visited', () => {
    seedTown(1000);

    expect(isTownDueForUpdate(townId, 'worker', 1)).toBe(false);
  });
});

describe('markTownSubsystemProcessed', () => {
  const mark = (interval: number) =>
    inTick(() => markTownSubsystemProcessed(townId, 'craft', interval));

  it('stamps the current tick on that subsystem alone', () => {
    seedTown(1234, { worker: 1 });

    mark(60);

    expect(worldTownsState()[townId].lastProcessedTick).toEqual({
      worker: 1,
      craft: 1234,
    });
  });

  it('skips an every-tick subsystem and a town never visited', () => {
    seedTown(1234, {});
    mark(1);
    expect(worldTownsState()[townId].lastProcessedTick).toEqual({});

    seedTown(1234);
    mark(60);
    expect(worldTownsState()).toEqual({});
  });
});
