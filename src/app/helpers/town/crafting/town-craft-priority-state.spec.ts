import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntriesByType: vi.fn(),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldTownsState: () => gamestate().world.towns,
  };
});

vi.mock('@helpers/town/crafting/town-craft-eligibility', () => ({
  isRecipeCraftableByTown: vi.fn(),
  isRecipeResultAtOrAboveThreshold: vi.fn(() => false),
}));

vi.mock('@helpers/town/town-tick', () => ({
  isTownDueForUpdate: vi.fn(() => true),
  markTownSubsystemProcessed: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  pruneInvalidTownSpecialtyPriority,
  resetTownSpecialtyPriority,
  townSpecialtyPriority,
  townSpecialtyPriorityProcessTick,
} from '@helpers/town/crafting/town-craft-priority-state';
import {
  isRecipeCraftableByTown,
  isRecipeResultAtOrAboveThreshold,
} from '@helpers/town/crafting/town-craft-eligibility';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  GameState,
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TownNodeState,
  TownSpecialtyPriorityEntry,
  TradeskillId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const specialtyId = 'jewelcrafting' as TradeskillId;
const ringRecipeId = 'ring-recipe' as RecipeId;

function buildTown(): TownContent {
  return {
    id: townId,
    crafting: {
      specialtyTradeskillId: specialtyId,
      uniqueRecipeIds: [ringRecipeId],
    },
  } as unknown as TownContent;
}

function buildRecipe(): RecipeContent {
  return {
    id: ringRecipeId,
    tradeskillId: specialtyId,
    result: { equipmentId: 'larsian-ring' },
    requirements: [],
  } as unknown as RecipeContent;
}

function buildTarget(overrides: Partial<TownNodeState> = {}): TownNodeState {
  return {
    craftQueue: [],
    stock: [],
    specialtyPriority: [],
    ...overrides,
  } as unknown as TownNodeState;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTownDueForUpdate).mockReturnValue(true);
  vi.mocked(isRecipeResultAtOrAboveThreshold).mockReturnValue(false);
});

describe('townSpecialtyPriority', () => {
  it('returns the stored priority list', () => {
    const priority: TownSpecialtyPriorityEntry[] = [
      { recipeId: ringRecipeId, failureCount: 2 },
    ];
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: { [townId]: { specialtyPriority: priority } } },
    } as unknown as GameState);

    expect(townSpecialtyPriority(townId)).toBe(priority);
  });

  it('is empty when the town has no state entry', () => {
    vi.mocked(gamestate).mockReturnValue({
      world: { towns: {} },
    } as unknown as GameState);

    expect(townSpecialtyPriority(townId)).toEqual([]);
  });
});

function buildState(target: TownNodeState): GameState {
  const state = {
    world: { towns: { [townId]: target } },
  } as unknown as GameState;
  return state;
}

describe('resetTownSpecialtyPriority', () => {
  it('removes the entry for the given recipe', () => {
    const state = buildState(
      buildTarget({
        specialtyPriority: [
          { recipeId: ringRecipeId, failureCount: 3 },
          { recipeId: 'other' as RecipeId, failureCount: 1 },
        ],
      }),
    );

    resetTownSpecialtyPriority(state, townId, ringRecipeId);

    expect(state.world.towns[townId].specialtyPriority).toEqual([
      { recipeId: 'other', failureCount: 1 },
    ]);
  });

  it('writes nothing when the recipe has no entry', () => {
    const state = buildState(buildTarget());
    const previous = state.world.towns;

    resetTownSpecialtyPriority(state, townId, ringRecipeId);

    expect(state.world.towns).toBe(previous);
    expect(state.world.towns[townId].specialtyPriority).toEqual([]);
  });

  it('does not throw when specialtyPriority is missing on a not-yet-migrated town state', () => {
    const state = buildState({
      craftQueue: [],
      stock: [],
    } as unknown as TownNodeState);

    expect(() =>
      resetTownSpecialtyPriority(state, townId, ringRecipeId),
    ).not.toThrow();
    expect(state.world.towns[townId].specialtyPriority).toEqual([]);
  });
});

describe('townSpecialtyPriorityProcessTick', () => {
  const town = buildTown();
  const recipe = buildRecipe();

  beforeEach(() => {
    vi.mocked(getEntriesByType).mockImplementation(
      (type) => (type === 'town' ? [town] : []) as never,
    );
    vi.mocked(getEntry).mockImplementation(
      (id) => (id === ringRecipeId ? recipe : undefined) as never,
    );
  });

  function applyTick(target: TownNodeState): TownNodeState {
    townSpecialtyPriorityProcessTick();
    const updateFn = vi.mocked(updateGamestate).mock.calls[0][0];
    const state = buildState(target);
    updateFn(state);
    return state.world.towns[townId];
  }

  it('does nothing when the town is not due for the specialty tick', () => {
    vi.mocked(isTownDueForUpdate).mockReturnValue(false);

    townSpecialtyPriorityProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(markTownSubsystemProcessed).not.toHaveBeenCalled();
  });

  it('increments failureCount for an uncraftable, unqueued, unstocked specialty recipe', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    const result = applyTick(buildTarget());

    expect(result.specialtyPriority).toEqual([
      { recipeId: ringRecipeId, failureCount: 1 },
    ]);
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(
      townId,
      'specialty',
      expect.any(Number),
    );
  });

  it('does not throw on a not-yet-migrated town state missing specialtyPriority entirely', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);
    const target = { craftQueue: [], stock: [] } as unknown as TownNodeState;

    expect(applyTick(target).specialtyPriority).toEqual([
      { recipeId: ringRecipeId, failureCount: 1 },
    ]);
  });

  it('bumps an existing entry rather than duplicating it', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    const result = applyTick(
      buildTarget({
        specialtyPriority: [{ recipeId: ringRecipeId, failureCount: 2 }],
      }),
    );

    expect(result.specialtyPriority).toEqual([
      { recipeId: ringRecipeId, failureCount: 3 },
    ]);
  });

  it('does not increment while the recipe is already craftable (just unpicked)', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(true);

    const result = applyTick(buildTarget());

    expect(result.specialtyPriority).toEqual([]);
  });

  it('does not increment while the recipe is already queued', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    const result = applyTick(
      buildTarget({
        craftQueue: [
          {
            id: 'q1' as never,
            tradeskillId: specialtyId,
            recipeId: ringRecipeId,
            ticksIntoCraft: 0,
          },
        ],
      }),
    );

    expect(result.specialtyPriority).toEqual([]);
  });

  it('does not increment while the recipe result is capped at its material threshold - more gathering cannot fix that', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);
    vi.mocked(isRecipeResultAtOrAboveThreshold).mockReturnValue(true);

    const result = applyTick(buildTarget());

    expect(result.specialtyPriority).toEqual([]);
  });

  it('does not increment while the recipe result is currently in shop stock', () => {
    vi.mocked(isRecipeCraftableByTown).mockReturnValue(false);

    const result = applyTick(
      buildTarget({
        stock: [
          {
            equipmentItem: { equipmentId: 'larsian-ring' } as never,
            addedAtTick: 0,
          },
        ],
      }),
    );

    expect(result.specialtyPriority).toEqual([]);
  });
});

describe('pruneInvalidTownSpecialtyPriority', () => {
  it('keeps entries whose recipe still resolves', () => {
    vi.mocked(getEntry).mockReturnValue({} as never);

    expect(
      pruneInvalidTownSpecialtyPriority([
        { recipeId: ringRecipeId, failureCount: 1 },
      ]),
    ).toEqual([{ recipeId: ringRecipeId, failureCount: 1 }]);
  });

  it('drops entries whose recipe no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(
      pruneInvalidTownSpecialtyPriority([
        { recipeId: ringRecipeId, failureCount: 1 },
      ]),
    ).toEqual([]);
  });
});
