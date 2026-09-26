import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    tasksState: () => gamestate().tasks,
  };
});

vi.mock('@helpers/task/task-completed', () => ({
  tasksCompletedEmit: vi.fn(),
}));

import { setAllContentById } from '@helpers/content/content';
import { ensureTask } from '@helpers/content/ensure-task';
import { defaultGameState } from '@helpers/defaults';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { tasksCompletedEmit } from '@helpers/task/task-completed';
import { tasksRecord } from '@helpers/task/task-record';
import type { GameState, IsContentItem, TaskId } from '@interfaces';

const LEVEL_TASK = 'task-level' as TaskId;

let state: GameState;

beforeEach(() => {
  vi.clearAllMocks();

  const content: IsContentItem[] = [
    ensureTask({
      id: LEVEL_TASK,
      order: 10,
      requirement: { kind: 'ReachLevel', level: 3 },
    }),
  ];
  setAllContentById(new Map(content.map((entry) => [entry.id, entry])));

  state = defaultGameState();
  state.tasks = { [LEVEL_TASK]: { progress: 0 } };
  vi.mocked(gamestate).mockImplementation(() => state);
});

describe('tasksRecord', () => {
  it('announces before returning when the write runs inside a tick', () => {
    vi.mocked(updateGamestate).mockImplementation((update) => {
      state = update(state);
      return Promise.resolve();
    });

    void tasksRecord((requirement) => requirement.kind === 'ReachLevel');

    expect(state.tasks[LEVEL_TASK].completedAt).toBeDefined();
    expect(tasksCompletedEmit).toHaveBeenCalledWith([
      expect.objectContaining({ id: LEVEL_TASK }),
    ]);
  });

  it('holds the announcement until a deferred write lands', async () => {
    let flush: () => void = () => undefined;
    vi.mocked(updateGamestate).mockImplementation(
      (update) =>
        new Promise<void>((resolve) => {
          flush = () => {
            state = update(state);
            resolve();
          };
        }),
    );

    const recording = tasksRecord(
      (requirement) => requirement.kind === 'ReachLevel',
    );
    expect(tasksCompletedEmit).not.toHaveBeenCalled();

    flush();
    await recording;

    expect(tasksCompletedEmit).toHaveBeenCalledWith([
      expect.objectContaining({ id: LEVEL_TASK }),
    ]);
  });

  it('announces a task only once when two records race for it', async () => {
    const pending: (() => void)[] = [];
    vi.mocked(updateGamestate).mockImplementation(
      (update) =>
        new Promise<void>((resolve) => {
          pending.push(() => {
            state = update(state);
            resolve();
          });
        }),
    );

    const first = tasksRecord(
      (requirement) => requirement.kind === 'ReachLevel',
    );
    const second = tasksRecord(
      (requirement) => requirement.kind === 'ReachLevel',
    );
    pending.forEach((run) => run());
    await Promise.all([first, second]);

    const announced = vi
      .mocked(tasksCompletedEmit)
      .mock.calls.flatMap(([tasks]) => tasks);
    expect(announced).toHaveLength(1);
  });

  it('skips the write when no incomplete task matches', async () => {
    state.tasks[LEVEL_TASK] = { progress: 0, completedAt: 1 };

    await tasksRecord((requirement) => requirement.kind === 'ReachLevel');

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
