import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/materials', () => ({
  hasGold: vi.fn(),
  spendGold: vi.fn(),
}));

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  kingdomNodeGet: vi.fn(),
}));

import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { hasGold, spendGold } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  WORKER_MAX_LEVEL,
  defaultWorkerState,
  workerGainXp,
  workerIsReadyToLevelUp,
  workerLevelUp,
  workerLevelUpCost,
  workerMinLevelForStamina,
  workerStatsForLevel,
  workerXpForLevel,
  workersReadyToLevelUpEntries,
} from '@helpers/worker/worker-progression';
import { kingdomNodeGet } from '@helpers/world-node/world-nodes';
import type {
  GameState,
  WorkerContent,
  WorkerId,
  WorkerState,
} from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

const WORKER_ID = 'weaver-nell' as WorkerId;

function buildWorker(overrides: Partial<WorkerState> = {}): WorkerState {
  return {
    level: 1,
    xp: { current: 0, maximum: 10 },
    location: { mapName: 'Carrina', x: 0, y: 0 },
    status: { kind: 'AtDuchy' },
    assignment: null,
    ...overrides,
  };
}

describe('workerXpForLevel', () => {
  it('is 10 at level 1', () => {
    expect(workerXpForLevel(1)).toBe(10);
  });

  it('is 10000 at the level cap', () => {
    expect(workerXpForLevel(WORKER_MAX_LEVEL)).toBe(10000);
  });

  it('increases monotonically between levels', () => {
    let previous = workerXpForLevel(1);
    for (let level = 2; level <= WORKER_MAX_LEVEL; level++) {
      const current = workerXpForLevel(level);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('workerStatsForLevel', () => {
  const worker: WorkerContent = {
    id: WORKER_ID,
    name: 'Weaver Nell',
    __type: 'worker',
    description: 'test',
    sprite: '0000',
    frames: 4,
    baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
    statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
  };

  it('returns exactly baseStats at level 1', () => {
    expect(workerStatsForLevel(worker, 1)).toEqual({
      capacity: 6,
      gatherSpeed: 1,
      stamina: 30,
    });
  });

  it('adds statsPerLevel * (level - 1) at higher levels', () => {
    expect(workerStatsForLevel(worker, 5)).toEqual({
      capacity: 8,
      gatherSpeed: 1.4,
      stamina: 38,
    });
  });
});

describe('workerMinLevelForStamina', () => {
  const worker: WorkerContent = {
    id: WORKER_ID,
    name: 'Weaver Nell',
    __type: 'worker',
    description: 'test',
    sprite: '0000',
    frames: 4,
    baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
    statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
  };

  it('is 1 when base stamina already covers the requirement', () => {
    expect(workerMinLevelForStamina(worker, 30)).toBe(1);
    expect(workerMinLevelForStamina(worker, 20)).toBe(1);
  });

  it('rounds up to the level whose stamina first covers the requirement', () => {
    expect(workerMinLevelForStamina(worker, 31)).toBe(2);
    expect(workerMinLevelForStamina(worker, 32)).toBe(2);
    expect(workerMinLevelForStamina(worker, 33)).toBe(3);
  });

  it('is undefined once the requirement exceeds stamina at WORKER_MAX_LEVEL', () => {
    const maxStamina = workerStatsForLevel(worker, WORKER_MAX_LEVEL).stamina;
    expect(workerMinLevelForStamina(worker, maxStamina)).toBe(WORKER_MAX_LEVEL);
    expect(workerMinLevelForStamina(worker, maxStamina + 1)).toBeUndefined();
  });

  it('is undefined for an unmet requirement when stamina never grows per level', () => {
    const flatWorker: WorkerContent = {
      ...worker,
      statsPerLevel: { capacity: 0, gatherSpeed: 0, stamina: 0 },
    };
    expect(workerMinLevelForStamina(flatWorker, 31)).toBeUndefined();
  });
});

describe('defaultWorkerState', () => {
  it('starts at level 1, AtDuchy, with no assignment', () => {
    vi.mocked(kingdomNodeGet).mockReturnValue({
      mapName: 'Carrina',
      x: 10,
      y: 10,
      nodeName: 'Duchy',
      nodeData: {} as never,
    });

    const state = defaultWorkerState();

    expect(state.level).toBe(1);
    expect(state.xp).toEqual({ current: 0, maximum: workerXpForLevel(1) });
    expect(state.status).toEqual({ kind: 'AtDuchy' });
    expect(state.assignment).toBeNull();
    expect(state.location).toEqual({ mapName: 'Carrina', x: 10, y: 10 });
  });

  it('falls back to an empty location when no Kingdom node exists', () => {
    vi.mocked(kingdomNodeGet).mockReturnValue(undefined);

    expect(defaultWorkerState().location).toEqual({
      mapName: '',
      x: 0,
      y: 0,
    });
  });
});

describe('workerGainXp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds xp up to the cap', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker({ xp: { current: 0, maximum: 10 } }) },
    } as unknown as GameState);

    workerGainXp(WORKER_ID, 4);

    const result = applyLastUpdate({
      workers: { [WORKER_ID]: buildWorker({ xp: { current: 0, maximum: 10 } }) },
    } as unknown as GameState);

    expect(result.workers[WORKER_ID].xp.current).toBe(4);
  });

  it('never banks past the current level cap', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker({ xp: { current: 8, maximum: 10 } }) },
    } as unknown as GameState);

    workerGainXp(WORKER_ID, 100);

    const result = applyLastUpdate({
      workers: { [WORKER_ID]: buildWorker({ xp: { current: 8, maximum: 10 } }) },
    } as unknown as GameState);

    expect(result.workers[WORKER_ID].xp.current).toBe(10);
  });

  it('is a no-op for a non-positive amount', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker() },
    } as unknown as GameState);

    workerGainXp(WORKER_ID, 0);

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('workerLevelUpCost', () => {
  it('is 10x the xp required for the next level', () => {
    expect(workerLevelUpCost(1)).toBe(workerXpForLevel(2) * 10);
  });
});

describe('workerIsReadyToLevelUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is false below the xp cap', () => {
    vi.mocked(hasGold).mockReturnValue(true);
    expect(
      workerIsReadyToLevelUp(buildWorker({ xp: { current: 5, maximum: 10 } })),
    ).toBe(false);
  });

  it('is false at the level cap even with maxed xp and gold', () => {
    vi.mocked(hasGold).mockReturnValue(true);
    expect(
      workerIsReadyToLevelUp(
        buildWorker({ level: WORKER_MAX_LEVEL, xp: { current: 10, maximum: 10 } }),
      ),
    ).toBe(false);
  });

  it('is false without enough gold', () => {
    vi.mocked(hasGold).mockReturnValue(false);
    expect(
      workerIsReadyToLevelUp(buildWorker({ xp: { current: 10, maximum: 10 } })),
    ).toBe(false);
  });

  it('is true once xp is maxed, gold is affordable, and under the cap', () => {
    vi.mocked(hasGold).mockReturnValue(true);
    expect(
      workerIsReadyToLevelUp(buildWorker({ xp: { current: 10, maximum: 10 } })),
    ).toBe(true);
  });
});

describe('workersReadyToLevelUpEntries', () => {
  const OTHER_ID = 'gobslime-pell' as WorkerId;

  const workerContent: WorkerContent = {
    id: WORKER_ID,
    name: 'Weaver Nell',
    __type: 'worker',
    description: 'test',
    sprite: '0000',
    frames: 4,
    baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
    statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes only workers ready to level up, resolved to their content', () => {
    vi.mocked(hasGold).mockReturnValue(true);
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildWorker({
          level: 3,
          xp: { current: 10, maximum: 10 },
        }),
        [OTHER_ID]: buildWorker({ xp: { current: 0, maximum: 10 } }),
      },
    } as unknown as GameState);
    vi.mocked(getEntry).mockImplementation((id: unknown) =>
      id === WORKER_ID ? workerContent : undefined,
    );

    expect(workersReadyToLevelUpEntries()).toEqual([
      {
        workerId: WORKER_ID,
        name: 'Weaver Nell',
        sprite: '0000',
        frames: 4,
        level: 3,
      },
    ]);
  });

  it('omits a ready worker whose content no longer resolves', () => {
    vi.mocked(hasGold).mockReturnValue(true);
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildWorker({ xp: { current: 10, maximum: 10 } }),
      },
    } as unknown as GameState);
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(workersReadyToLevelUpEntries()).toEqual([]);
  });
});

describe('workerLevelUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails when the worker does not exist', () => {
    vi.mocked(gamestate).mockReturnValue({ workers: {} } as unknown as GameState);

    expect(workerLevelUp(WORKER_ID)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails at the level cap', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker({ level: WORKER_MAX_LEVEL }) },
    } as unknown as GameState);

    expect(workerLevelUp(WORKER_ID)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails without enough gold', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildWorker({
          level: 1,
          xp: { current: 10, maximum: 10 },
        }),
      },
    } as unknown as GameState);
    vi.mocked(hasGold).mockReturnValue(false);

    expect(workerLevelUp(WORKER_ID)).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('spends gold, levels up, and resets xp when affordable', () => {
    const atCapXp = { current: 10, maximum: 10 };
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildWorker({ level: 1, xp: atCapXp }) },
    } as unknown as GameState);
    vi.mocked(hasGold).mockReturnValue(true);

    expect(workerLevelUp(WORKER_ID)).toBe(true);

    const draftState = {
      workers: { [WORKER_ID]: buildWorker({ level: 1, xp: atCapXp }) },
    } as unknown as GameState;
    const result = applyLastUpdate(draftState);

    expect(spendGold).toHaveBeenCalledWith(draftState, workerLevelUpCost(1));
    expect(result.workers[WORKER_ID].level).toBe(2);
    expect(result.workers[WORKER_ID].xp).toEqual({
      current: 0,
      maximum: workerXpForLevel(2),
    });
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith('Worker:LevelUp');
  });
});
