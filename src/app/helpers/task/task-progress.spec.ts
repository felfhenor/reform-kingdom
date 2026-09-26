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
import {
  taskRecordAstralCast,
  taskRecordCraft,
  taskRecordEncounterClear,
  taskRecordGather,
} from '@helpers/task/task-progress';
import type {
  AstralProjectorId,
  GameState,
  IsContentItem,
  ItemId,
  RecipeId,
  TaskId,
} from '@interfaces';

const GATHER_TASK = 'task-gather' as TaskId;
const CRAFT_TASK = 'task-craft' as TaskId;
const CLEAR_TASK = 'task-clear' as TaskId;
const CAST_TASK = 'task-cast' as TaskId;
const DUCHY_SPELL = 'spell-duchy' as AstralProjectorId;
const STICK = 'item-stick' as ItemId;
const INGOT_RECIPE = 'recipe-ingot' as RecipeId;

let state: GameState;

beforeEach(() => {
  vi.clearAllMocks();

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
  setAllContentById(new Map(content.map((entry) => [entry.id, entry])));

  state = defaultGameState();
  state.tasks = {
    [GATHER_TASK]: { progress: 0 },
    [CRAFT_TASK]: { progress: 0 },
    [CLEAR_TASK]: { progress: 0 },
    [CAST_TASK]: { progress: 0 },
  };
  vi.mocked(gamestate).mockImplementation(() => state);
  // Mirrors an in-tick write: the callback runs synchronously.
  vi.mocked(updateGamestate).mockImplementation((update) => {
    state = update(state);
    return Promise.resolve();
  });
});

describe('taskRecordGather', () => {
  it('skips the state write when no task matches the node and item', () => {
    taskRecordGather('Carrina Copper Mines', STICK, 3);
    taskRecordGather('Wergen Woods', 'item-wood' as ItemId, 3);

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('adds progress without completing below the target', () => {
    taskRecordGather('Wergen Woods', STICK, 3);

    expect(state.tasks[GATHER_TASK]).toEqual({ progress: 3 });
    expect(tasksCompletedEmit).toHaveBeenCalledWith([]);
  });

  it('caps progress at the target, latches, and announces', () => {
    state.tasks[GATHER_TASK] = { progress: 4 };

    taskRecordGather('Wergen Woods', STICK, 3);

    expect(state.tasks[GATHER_TASK].progress).toBe(5);
    expect(state.tasks[GATHER_TASK].completedAt).toBeDefined();
    expect(tasksCompletedEmit).toHaveBeenCalledWith([
      expect.objectContaining({ id: GATHER_TASK }),
    ]);
  });

  it('ignores tasks that are already complete', () => {
    state.tasks[GATHER_TASK] = { progress: 5, completedAt: 1 };

    taskRecordGather('Wergen Woods', STICK, 3);

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('taskRecordCraft', () => {
  it('completes the matching craft task', () => {
    taskRecordCraft(INGOT_RECIPE);

    expect(state.tasks[CRAFT_TASK].completedAt).toBeDefined();
  });

  it('skips the state write for an unrelated recipe', () => {
    taskRecordCraft('recipe-sword' as RecipeId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('taskRecordEncounterClear', () => {
  it('counts one clear per call', () => {
    taskRecordEncounterClear('Forest Ruins');

    expect(state.tasks[CLEAR_TASK]).toEqual({ progress: 1 });
  });

  it('creates the entry when a save somehow lacks one', () => {
    delete state.tasks[CLEAR_TASK];

    taskRecordEncounterClear('Forest Ruins');

    expect(state.tasks[CLEAR_TASK]).toEqual({ progress: 1 });
  });
});

describe('taskRecordAstralCast', () => {
  it('waits for the deferred write before announcing the completed cast', async () => {
    vi.mocked(updateGamestate).mockImplementation(async (update) => {
      await Promise.resolve();
      state = update(state);
    });

    await taskRecordAstralCast(DUCHY_SPELL);

    expect(state.tasks[CAST_TASK].completedAt).toBeDefined();
    expect(tasksCompletedEmit).toHaveBeenCalledWith([
      expect.objectContaining({ id: CAST_TASK }),
    ]);
  });

  it('skips the state write for a spell no task asks for', async () => {
    await taskRecordAstralCast('spell-other' as AstralProjectorId);

    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
