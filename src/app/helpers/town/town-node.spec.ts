import { deepFreeze } from '@helpers/engine/deep-freeze';
import { updateTownNode, updateTownWorker } from '@helpers/town/town-node';
import type {
  GameState,
  TownId,
  TownNodeState,
  TownWorkerState,
  WorkerId,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

const townId = 'larsia' as TownId;
const otherTownId = 'carrina' as TownId;
const workerId = 'weaver' as WorkerId;

function buildWorker(
  overrides: Partial<TownWorkerState> = {},
): TownWorkerState {
  return {
    level: 1,
    location: { mapName: 'Larsia', x: 0, y: 0 },
    status: { kind: 'AtTown' },
    assignment: null,
    ...overrides,
  };
}

function buildTown(overrides: Partial<TownNodeState> = {}): TownNodeState {
  return {
    lastProcessedTick: {},
    stock: [],
    workers: { [workerId]: buildWorker() },
    reputation: 0,
    hiddenGold: 0,
    materials: {},
    tradeskills: {},
    craftQueue: [],
    commissionSlots: [],
    specialtyPriority: [],
    ...overrides,
  } as TownNodeState;
}

function buildState(): GameState {
  return {
    world: {
      towns: { [townId]: buildTown(), [otherTownId]: buildTown() },
    },
  } as unknown as GameState;
}

describe('updateTownNode', () => {
  it('replaces the node and the dict, leaving the frozen originals untouched', () => {
    const state = buildState();
    const previousDict = deepFreeze(state.world.towns);
    const previousNode = previousDict[townId];

    updateTownNode(state, townId, (town) => {
      town.hiddenGold = 5;
    });

    expect(state.world.towns).not.toBe(previousDict);
    expect(state.world.towns[townId]).not.toBe(previousNode);
    expect(state.world.towns[townId].hiddenGold).toBe(5);
    expect(previousNode.hiddenGold).toBe(0);
  });

  it('keeps other towns and untouched fields by reference', () => {
    const state = buildState();
    const previousDict = deepFreeze(state.world.towns);

    updateTownNode(state, townId, (town) => {
      town.hiddenGold = 5;
    });

    expect(state.world.towns[otherTownId]).toBe(previousDict[otherTownId]);
    expect(state.world.towns[townId].workers).toBe(
      previousDict[townId].workers,
    );
  });

  it('writes nothing when the draft ends up identical to the original', () => {
    const state = buildState();
    const previousDict = deepFreeze(state.world.towns);

    updateTownNode(state, townId, (town) => {
      town.hiddenGold += 0;
    });

    expect(state.world.towns).toBe(previousDict);
  });

  it('writes nothing when a rebuilt array holds the same elements', () => {
    const entry = { id: 'q1' } as never;
    const state = buildState();
    state.world.towns[townId] = buildTown({ craftQueue: [entry] });
    const previousDict = deepFreeze(state.world.towns);

    updateTownNode(state, townId, (town) => {
      town.craftQueue = [...town.craftQueue];
    });

    expect(state.world.towns).toBe(previousDict);
  });

  it('writes when a rebuilt array differs by an element', () => {
    const state = buildState();
    state.world.towns[townId] = buildTown({
      craftQueue: [{ id: 'q1' } as never],
    });
    const previousDict = deepFreeze(state.world.towns);

    updateTownNode(state, townId, (town) => {
      town.craftQueue = [{ id: 'q1' } as never];
    });

    expect(state.world.towns).not.toBe(previousDict);
  });

  it('does nothing for a town with no state', () => {
    const state = buildState();
    const previousDict = state.world.towns;

    updateTownNode(state, 'missing' as TownId, () => {
      throw new Error('should not run');
    });

    expect(state.world.towns).toBe(previousDict);
  });
});

describe('updateTownWorker', () => {
  it('replaces the worker, the node and the dict without mutating the originals', () => {
    const state = buildState();
    const previousDict = deepFreeze(state.world.towns);
    const previousWorker = previousDict[townId].workers[workerId];

    updateTownWorker(state, townId, workerId, (worker) => {
      worker.status = { kind: 'Resting', ticksIntoRest: 0 };
    });

    expect(state.world.towns).not.toBe(previousDict);
    expect(state.world.towns[townId].workers[workerId]).not.toBe(
      previousWorker,
    );
    expect(state.world.towns[townId].workers[workerId].status.kind).toBe(
      'Resting',
    );
    expect(previousWorker.status.kind).toBe('AtTown');
  });

  it('writes nothing when the worker draft ends up identical to the original', () => {
    const state = buildState();
    const previousDict = deepFreeze(state.world.towns);

    updateTownWorker(state, townId, workerId, () => undefined);

    expect(state.world.towns).toBe(previousDict);
  });

  it('does nothing for an unknown worker', () => {
    const state = buildState();
    const previousDict = state.world.towns;

    updateTownWorker(state, townId, 'nobody' as WorkerId, () => {
      throw new Error('should not run');
    });

    expect(state.world.towns).toBe(previousDict);
  });
});
