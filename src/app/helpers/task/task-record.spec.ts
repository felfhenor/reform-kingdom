import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';

import { ensureTask } from '@helpers/content/ensure-task';
import { tasksState } from '@helpers/state-game';
import { tasksCompleted$ } from '@helpers/task/task-completed';
import { tasksRecord } from '@helpers/task/task-record';
import type { TaskContent, TaskId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const levelTask = ensureTask({
  id: 'task-level' as TaskId,
  order: 10,
  requirement: { kind: 'ReachLevel', level: 3 },
});

const reachedLevel = () =>
  tasksRecord((requirement) => requirement.kind === 'ReachLevel');

function captureAnnouncements(): TaskContent[][] {
  const announced: TaskContent[][] = [];
  const subscription = tasksCompleted$.subscribe((tasks) =>
    announced.push(tasks),
  );
  onTestFinished(() => subscription.unsubscribe());
  return announced;
}

beforeEach(() => {
  seedContent([levelTask]);
  seedGamestate((state) => (state.tasks = { [levelTask.id]: { progress: 0 } }));
});

describe('tasksRecord', () => {
  it('completes the task and announces it before returning inside a tick', () => {
    const announced = captureAnnouncements();

    void inTick(() => reachedLevel());

    expect(tasksState()[levelTask.id].completedAt).toEqual(expect.any(Number));
    expect(announced).toEqual([[levelTask]]);
  });

  it('holds the announcement until a deferred write lands', async () => {
    const announced = captureAnnouncements();

    const recording = reachedLevel();
    expect(announced).toEqual([]);

    await recording;
    expect(tasksState()[levelTask.id].completedAt).toEqual(expect.any(Number));
    expect(announced).toEqual([[levelTask]]);
  });

  it('announces a task only once when two deferred records race for it', async () => {
    const announced = captureAnnouncements();

    await Promise.all([reachedLevel(), reachedLevel()]);

    expect(announced.flat()).toEqual([levelTask]);
  });

  it('does nothing when no incomplete task matches', async () => {
    seedGamestate(
      (state) =>
        (state.tasks = { [levelTask.id]: { progress: 0, completedAt: 1 } }),
    );
    const announced = captureAnnouncements();

    await reachedLevel();

    expect(tasksState()[levelTask.id].completedAt).toBe(1);
    expect(announced).toEqual([]);
  });
});
