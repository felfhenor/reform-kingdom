import { describe, expect, it } from 'vitest';

import { TOWN_SPECIALTY_PRIORITY_TICK_INTERVAL } from '@helpers/config';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { defaultGameState } from '@helpers/defaults';
import {
  pruneInvalidTownSpecialtyPriority,
  resetTownSpecialtyPriority,
  townSpecialtyPriority,
  townSpecialtyPriorityProcessTick,
} from '@helpers/town/crafting/town-craft-priority-state';
import type {
  CraftQueueEntryId,
  EquipmentId,
  ItemId,
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TownNodeState,
  TownSpecialtyPriorityEntry,
} from '@interfaces';
import { buildEquipmentItem, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const gemId = 'gem' as ItemId;
const dustId = 'dust' as ItemId;
const ringId = 'larsian-ring' as EquipmentId;

const ringRecipe = ensureRecipe({
  id: 'ring-recipe' as RecipeId,
  requirements: [{ itemId: gemId, quantity: 2 }],
  result: { equipmentId: ringId },
});
const dustRecipe = ensureRecipe({
  id: 'dust-recipe' as RecipeId,
  requirements: [{ itemId: gemId, quantity: 2 }],
  result: { itemId: dustId, quantity: 1 },
});

function seedTown(
  specialty: RecipeContent,
  crafting: Partial<TownContent['crafting']> = {},
): void {
  seedContent([
    ensureTown({
      id: townId,
      crafting: {
        uniqueRecipeIds: [specialty.id],
        ...crafting,
      } as TownContent['crafting'],
      materialThresholds: [
        { itemId: dustId, maxQuantity: 10 },
      ] as TownContent['materialThresholds'],
    }),
    ringRecipe,
    dustRecipe,
  ]);
}

function seedTownState(overrides: Partial<TownNodeState> = {}): void {
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState(overrides);
  });
}

function priorityAfterTick(): TownSpecialtyPriorityEntry[] {
  inTick(townSpecialtyPriorityProcessTick);
  return townSpecialtyPriority(townId);
}

const ringFailure = (failureCount: number) => ({
  recipeId: ringRecipe.id,
  failureCount,
});

describe('townSpecialtyPriority', () => {
  it('reads the stored list, or nothing for a town never visited', () => {
    seedTownState({ specialtyPriority: [ringFailure(2)] });

    expect(townSpecialtyPriority(townId)).toEqual([ringFailure(2)]);
    expect(townSpecialtyPriority('other' as TownId)).toEqual([]);
  });
});

describe('resetTownSpecialtyPriority', () => {
  it('removes only the given recipe', () => {
    const state = defaultGameState();
    state.world.towns[townId] = buildTownNodeState({
      specialtyPriority: [
        ringFailure(3),
        { recipeId: dustRecipe.id, failureCount: 1 },
      ],
    });

    resetTownSpecialtyPriority(state, townId, ringRecipe.id);

    expect(state.world.towns[townId].specialtyPriority).toEqual([
      { recipeId: dustRecipe.id, failureCount: 1 },
    ]);
  });

  it('leaves the list untouched when the recipe has no entry', () => {
    const state = defaultGameState();
    const priority = [{ recipeId: dustRecipe.id, failureCount: 1 }];
    state.world.towns[townId] = buildTownNodeState({
      specialtyPriority: priority,
    });

    resetTownSpecialtyPriority(state, townId, ringRecipe.id);

    expect(state.world.towns[townId].specialtyPriority).toBe(priority);
  });
});

describe('townSpecialtyPriorityProcessTick', () => {
  it('records a failure for a specialty the town cannot craft, bumping an existing entry', () => {
    seedTown(ringRecipe);
    seedTownState();

    expect(priorityAfterTick()).toEqual([ringFailure(1)]);

    seedTownState({ specialtyPriority: [ringFailure(2)] });
    expect(priorityAfterTick()).toEqual([ringFailure(3)]);
  });

  it('waits out the tick interval between evaluations', () => {
    seedTown(ringRecipe);
    seedGamestate((state) => {
      state.clock.numTicks = 1000;
      state.world.towns[townId] = buildTownNodeState({
        lastProcessedTick: { specialty: 1000 },
      });
    });

    expect(priorityAfterTick()).toEqual([]);

    seedGamestate((state) => {
      state.clock.numTicks = 1000 + TOWN_SPECIALTY_PRIORITY_TICK_INTERVAL;
      state.world.towns[townId] = buildTownNodeState({
        lastProcessedTick: { specialty: 1000 },
      });
    });
    expect(priorityAfterTick()).toEqual([ringFailure(1)]);
  });

  it('does not count a specialty the town can craft but has not picked yet', () => {
    seedTown(ringRecipe);
    seedTownState({ materials: { [gemId]: 2 } });

    expect(priorityAfterTick()).toEqual([]);
  });

  it('does not count a specialty that is already queued or in stock', () => {
    seedTown(ringRecipe);

    seedTownState({
      craftQueue: [
        {
          id: 'q1' as CraftQueueEntryId,
          tradeskillId: 'jewelcrafting' as never,
          recipeId: ringRecipe.id,
          ticksIntoCraft: 0,
        },
      ],
    });
    expect(priorityAfterTick()).toEqual([]);

    seedTownState({
      stock: [{ equipmentItem: buildEquipmentItem(ringId), addedAtTick: 0 }],
    });
    expect(priorityAfterTick()).toEqual([]);

    seedTownState({
      stock: [
        {
          equipmentItem: buildEquipmentItem('axe' as EquipmentId),
          addedAtTick: 0,
        },
      ],
    });
    expect(priorityAfterTick()).toEqual([ringFailure(1)]);
  });

  it('ignores a specialty id whose recipe no longer exists', () => {
    seedTown(ringRecipe, {
      uniqueRecipeIds: ['gone' as RecipeId, ringRecipe.id],
    });
    seedTownState();

    expect(priorityAfterTick()).toEqual([ringFailure(1)]);
  });

  it('does not count a specialty whose output is capped, since more gathering cannot fix that', () => {
    seedTown(dustRecipe);
    seedTownState({ materials: { [dustId]: 10 } });

    expect(priorityAfterTick()).toEqual([]);
  });

  it('does not count a specialty the town also bans', () => {
    seedTown(ringRecipe, { bannedRecipeIds: [ringRecipe.id] });
    seedTownState();

    expect(priorityAfterTick()).toEqual([]);
  });
});

describe('pruneInvalidTownSpecialtyPriority', () => {
  it('drops only the entries whose recipe no longer resolves', () => {
    seedTown(ringRecipe);

    expect(
      pruneInvalidTownSpecialtyPriority([
        ringFailure(1),
        { recipeId: 'gone' as RecipeId, failureCount: 4 },
      ]),
    ).toEqual([ringFailure(1)]);
  });
});
