import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById } from '@helpers/content/content';
import { ensureTask } from '@helpers/content/ensure-task';
import { defaultGameState } from '@helpers/defaults';
import { pruneInvalidTasks, retrofitTasks } from '@helpers/task/task-migrate';
import type { Character, IsContentItem, ItemId, TaskId } from '@interfaces';

const LEVEL_TASK = 'task-level' as TaskId;
const GATHER_TASK = 'task-gather' as TaskId;

beforeEach(() => {
  const content: IsContentItem[] = [
    ensureTask({
      id: LEVEL_TASK,
      order: 10,
      requirement: { kind: 'ReachLevel', level: 3 },
    }),
    ensureTask({
      id: GATHER_TASK,
      order: 20,
      requirement: {
        kind: 'GatherItem',
        nodeName: 'Wergen Woods',
        itemId: 'item-stick' as ItemId,
        quantity: 5,
      },
    }),
  ];
  setAllContentById(new Map(content.map((entry) => [entry.id, entry])));
});

describe('pruneInvalidTasks', () => {
  it('drops entries for tasks that no longer exist', () => {
    const pruned = pruneInvalidTasks({
      [LEVEL_TASK]: { progress: 0 },
      ['removed-task' as TaskId]: { progress: 2 },
    });

    expect(Object.keys(pruned)).toEqual([LEVEL_TASK]);
  });
});

describe('retrofitTasks', () => {
  it('creates an incomplete entry for every task on a fresh save', () => {
    const tasks = retrofitTasks(defaultGameState());

    expect(tasks[LEVEL_TASK]).toEqual({ progress: 0 });
    expect(tasks[GATHER_TASK]).toEqual({ progress: 0 });
  });

  it('latches unclaimed tasks an older save already satisfies', () => {
    const state = defaultGameState();
    state.world.party = [{ level: 4, teachings: {} } as unknown as Character];

    const tasks = retrofitTasks(state);

    expect(tasks[LEVEL_TASK].completedAt).toBeDefined();
    expect(tasks[LEVEL_TASK].claimedAt).toBeUndefined();
    expect(tasks[GATHER_TASK].completedAt).toBeUndefined();
  });

  it('re-checks an existing incomplete state-based entry, since only events latch it in play', () => {
    const state = defaultGameState();
    state.world.party = [{ level: 4, teachings: {} } as unknown as Character];
    state.tasks[LEVEL_TASK] = { progress: 0 };

    const tasks = retrofitTasks(state);

    expect(tasks[LEVEL_TASK].completedAt).toBeDefined();
  });

  it('keeps an existing counter entry and its progress instead of guessing from ledgers', () => {
    const state = defaultGameState();
    state.discoveredGatherNodes['Wergen Woods'] = { foundAt: 1 };
    state.discoveredMaterials['item-stick' as ItemId] = { foundAt: 1 };
    state.tasks[GATHER_TASK] = { progress: 2 };

    const tasks = retrofitTasks(state);

    expect(tasks[GATHER_TASK]).toEqual({ progress: 2 });
  });

  it('never touches a task that is already complete', () => {
    const state = defaultGameState();
    state.tasks[LEVEL_TASK] = { progress: 0, completedAt: 5, claimedAt: 6 };

    const tasks = retrofitTasks(state);

    expect(tasks[LEVEL_TASK]).toEqual({
      progress: 0,
      completedAt: 5,
      claimedAt: 6,
    });
  });
});
