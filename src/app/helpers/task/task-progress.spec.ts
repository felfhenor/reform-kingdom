import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';

import { ensureTask } from '@helpers/content/ensure-task';
import { tasksState } from '@helpers/state-game';
import { tasksCompleted$ } from '@helpers/task/task-completed';
import {
  taskRecordAstralCast,
  taskRecordCraft,
  taskRecordEncounterClear,
  taskRecordGather,
} from '@helpers/task/task-progress';
import type {
  AstralProjectorId,
  GameStateTasks,
  IsContentItem,
  ItemId,
  RecipeId,
  TaskContent,
  TaskId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const GATHER_TASK = 'task-gather' as TaskId;
const CRAFT_TASK = 'task-craft' as TaskId;
const CLEAR_TASK = 'task-clear' as TaskId;
const CAST_TASK = 'task-cast' as TaskId;
const DUCHY_SPELL = 'spell-duchy' as AstralProjectorId;
const STICK = 'item-stick' as ItemId;
const INGOT_RECIPE = 'recipe-ingot' as RecipeId;

const fresh = { progress: 0 };
const startingTasks: GameStateTasks = {
  [GATHER_TASK]: fresh,
  [CRAFT_TASK]: fresh,
  [CLEAR_TASK]: fresh,
  [CAST_TASK]: fresh,
};

function seedTasks(overrides: GameStateTasks = {}) {
  seedGamestate((state) => (state.tasks = { ...startingTasks, ...overrides }));
}

let announced: TaskContent[][];

beforeEach(() => {
  const content: IsContentItem[] = [
    ensureTask({
      id: GATHER_TASK,
      order: 10,
      requirement: {
        kind: 'GatherItem',
        nodeName: 'Wergen Woods',
        itemId: STICK,
        quantity: 5,
      },
    }),
    ensureTask({
      id: CRAFT_TASK,
      order: 20,
      requirement: { kind: 'CraftRecipe', recipeId: INGOT_RECIPE, quantity: 1 },
    }),
    ensureTask({
      id: CLEAR_TASK,
      order: 30,
      requirement: {
        kind: 'ClearEncounter',
        nodeName: 'Forest Ruins',
        quantity: 2,
      },
    }),
    ensureTask({
      id: CAST_TASK,
      order: 40,
      requirement: {
        kind: 'CastAstralSpell',
        astralProjectorId: DUCHY_SPELL,
        quantity: 1,
      },
    }),
  ];
  seedContent(content);
  seedTasks();

  announced = [];
  const subscription = tasksCompleted$.subscribe((tasks) =>
    announced.push(tasks),
  );
  onTestFinished(() => subscription.unsubscribe());
});

const task = (id: TaskId) => tasksState()[id];

describe('taskRecordGather', () => {
  it('ignores a node or item no task asks for', () => {
    inTick(() => {
      taskRecordGather('Carrina Copper Mines', STICK, 3);
      taskRecordGather('Wergen Woods', 'item-wood' as ItemId, 3);
    });

    expect(task(GATHER_TASK)).toEqual(fresh);
  });

  it('adds progress without completing below the target', () => {
    inTick(() => taskRecordGather('Wergen Woods', STICK, 3));

    expect(task(GATHER_TASK)).toEqual({ progress: 3 });
    expect(announced.flat()).toEqual([]);
  });

  it('caps progress at the target, completes and announces', () => {
    seedTasks({ [GATHER_TASK]: { progress: 4 } });

    inTick(() => taskRecordGather('Wergen Woods', STICK, 3));

    expect(task(GATHER_TASK)).toEqual({
      progress: 5,
      completedAt: expect.any(Number),
    });
    expect(announced.flat().map((t) => t.id)).toEqual([GATHER_TASK]);
  });

  it('leaves a completed task alone', () => {
    seedTasks({ [GATHER_TASK]: { progress: 5, completedAt: 1 } });

    inTick(() => taskRecordGather('Wergen Woods', STICK, 3));

    expect(task(GATHER_TASK)).toEqual({ progress: 5, completedAt: 1 });
    expect(announced.flat()).toEqual([]);
  });
});

describe('taskRecordCraft', () => {
  it('completes the matching craft task only', () => {
    inTick(() => taskRecordCraft('recipe-sword' as RecipeId));
    expect(task(CRAFT_TASK)).toEqual(fresh);

    inTick(() => taskRecordCraft(INGOT_RECIPE));
    expect(task(CRAFT_TASK).completedAt).toEqual(expect.any(Number));
  });
});

describe('taskRecordEncounterClear', () => {
  it('counts one clear per call, creating an entry a save lacks', () => {
    inTick(() => taskRecordEncounterClear('Forest Ruins'));
    expect(task(CLEAR_TASK)).toEqual({ progress: 1 });

    seedGamestate((state) => {
      state.tasks = { ...startingTasks };
      delete state.tasks[CLEAR_TASK];
    });
    inTick(() => taskRecordEncounterClear('Forest Ruins'));
    expect(task(CLEAR_TASK)).toEqual({ progress: 1 });
  });
});

describe('taskRecordAstralCast', () => {
  it('announces the completed cast once the deferred write lands', async () => {
    await taskRecordAstralCast(DUCHY_SPELL);

    expect(task(CAST_TASK).completedAt).toEqual(expect.any(Number));
    expect(announced.flat().map((t) => t.id)).toEqual([CAST_TASK]);
  });

  it('ignores a spell no task asks for', async () => {
    await taskRecordAstralCast('spell-other' as AstralProjectorId);

    expect(task(CAST_TASK)).toEqual(fresh);
  });
});
