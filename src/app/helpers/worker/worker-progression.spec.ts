import { beforeEach, describe, expect, it } from 'vitest';

import {
  WORKER_MAX_LEVEL,
  WORKER_XP_END,
  WORKER_XP_START,
} from '@helpers/config';
import { ensureItem } from '@helpers/content/ensure-item';
import { roundToNearest10 } from '@helpers/engine/number';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { applyMaterialDelta } from '@helpers/item/materials';
import { workersState } from '@helpers/state-game';
import {
  defaultWorkerState,
  workerGainXp,
  workerIsReadyToLevelUp,
  workerLevelUpCost,
  workerMinLevelForStamina,
  workerStatsForLevel,
  workerXpForLevel,
} from '@helpers/worker/worker-progression';
import type { ItemId, WorkerId, WorkerState } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const goldId = 'gold' as ItemId;
const nell = ensureWorker({
  id: 'weaver-nell' as WorkerId,
  name: 'Weaver Nell',
  baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
  statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
});

function worker(overrides: Partial<WorkerState> = {}): WorkerState {
  return { ...defaultWorkerState(), ...overrides };
}

beforeEach(() => {
  seedContent([nell, ensureItem({ id: goldId, name: 'Gold Coin' })]);
});

describe('workerXpForLevel', () => {
  it('climbs from the starting to the final requirement, never dropping', () => {
    const xp = Array.from({ length: WORKER_MAX_LEVEL }, (_, i) =>
      workerXpForLevel(i + 1),
    );

    expect(xp[0]).toBe(roundToNearest10(WORKER_XP_START));
    expect(xp.at(-1)).toBe(roundToNearest10(WORKER_XP_END));
    expect(xp.every((value, i) => i === 0 || value >= xp[i - 1])).toBe(true);
  });
});

describe('workerStatsForLevel', () => {
  it('grows each stat by its per-level amount from level 1', () => {
    expect(workerStatsForLevel(nell, 1)).toEqual(nell.baseStats);
    expect(workerStatsForLevel(nell, 5)).toEqual({
      capacity: 6 + 0.5 * 4,
      gatherSpeed: 1 + 0.1 * 4,
      stamina: 30 + 2 * 4,
    });
  });
});

describe('workerMinLevelForStamina', () => {
  it('finds the first level whose stamina covers the requirement', () => {
    expect(workerMinLevelForStamina(nell, 20)).toBe(1);
    expect(workerMinLevelForStamina(nell, 30)).toBe(1);
    expect(workerMinLevelForStamina(nell, 31)).toBe(2);
    expect(workerMinLevelForStamina(nell, 32)).toBe(2);
    expect(workerMinLevelForStamina(nell, 33)).toBe(3);
  });

  it('gives up past the level cap, or when stamina never grows', () => {
    const maxStamina = workerStatsForLevel(nell, WORKER_MAX_LEVEL).stamina;
    expect(workerMinLevelForStamina(nell, maxStamina)).toBe(WORKER_MAX_LEVEL);
    expect(workerMinLevelForStamina(nell, maxStamina + 1)).toBeUndefined();

    const flat = {
      ...nell,
      statsPerLevel: { ...nell.statsPerLevel, stamina: 0 },
    };
    expect(workerMinLevelForStamina(flat, 31)).toBeUndefined();
  });
});

describe('defaultWorkerState', () => {
  it('starts a fresh level 1 worker idle at the Duchy', () => {
    const { Duchy } = seedWorldNodes([
      { name: 'Duchy', type: 'Kingdom', x: 10, y: 10 },
    ]);

    expect(defaultWorkerState()).toEqual({
      level: 1,
      xp: { current: 0, maximum: workerXpForLevel(1) },
      location: locationOf(Duchy),
      status: { kind: 'AtDuchy' },
      assignment: null,
    });
  });

  it('starts nowhere when there is no Duchy on the map', () => {
    expect(defaultWorkerState().location).toEqual({ mapName: '', x: 0, y: 0 });
  });
});

describe('workerGainXp', () => {
  function gain(amount: number, current: number): number {
    seedGamestate((state) => {
      state.workers[nell.id] = worker({ xp: { current, maximum: 10 } });
    });
    inTick(() => workerGainXp(nell.id, amount));
    return workersState()[nell.id].xp.current;
  }

  it('adds xp, but never banks past the current level cap', () => {
    expect(gain(4, 0)).toBe(4);
    expect(gain(100, 8)).toBe(10);
    expect(gain(-5, 8)).toBe(8);
  });
});

describe('workerIsReadyToLevelUp', () => {
  const maxed = { current: 10, maximum: 10 };

  function readyWith(gold: number, state: Partial<WorkerState>): boolean {
    seedGamestate((s) => applyMaterialDelta(s, goldId, gold));
    return workerIsReadyToLevelUp(worker(state));
  }

  it('needs maxed xp, the gold for the next level and room under the level cap', () => {
    const cost = workerLevelUpCost(1);

    expect(readyWith(cost, { xp: maxed })).toBe(true);
    expect(readyWith(cost - 1, { xp: maxed })).toBe(false);
    expect(readyWith(cost, { xp: { current: 9, maximum: 10 } })).toBe(false);
    expect(
      readyWith(workerLevelUpCost(WORKER_MAX_LEVEL), {
        level: WORKER_MAX_LEVEL,
        xp: maxed,
      }),
    ).toBe(false);
  });

  it('prices each level-up in proportion to the xp of the level being reached', () => {
    expect(workerLevelUpCost(2)).toBeGreaterThan(workerLevelUpCost(1));
    expect(workerLevelUpCost(50) / workerXpForLevel(51)).toBeCloseTo(
      workerLevelUpCost(98) / workerXpForLevel(99),
    );
  });
});
