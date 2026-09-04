import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/crafting/tradeskill', () => ({
  craftXpChance: vi.fn(() => 100),
}));

vi.mock('@helpers/item/equipment', () => ({
  newEquipmentItem: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngSucceedsChance: vi.fn(() => true),
  rngUuid: vi.fn(() => 'queue-entry-1'),
}));

vi.mock('@helpers/state-game', () => ({
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/crafting/town-craft-pick', () => ({
  townPickRecipeToQueue: vi.fn(),
}));

vi.mock('@helpers/town/raid/town-raid-state', () => ({
  isTownCraftDebuffActive: vi.fn(() => false),
}));

vi.mock('@helpers/town/crafting/town-craft-level', () => ({
  townTradeskillLeveledUp: vi.fn((building) => building),
}));

vi.mock('@helpers/town/shop/town-stock', () => ({
  applyTownStockAdd: vi.fn(),
}));

vi.mock('@helpers/town/shop/town-shop-access', () => ({
  townShopItemCap: vi.fn(() => 10),
}));

vi.mock('@helpers/town/town-materials', () => ({
  applyTownMaterialDelta: vi.fn(),
}));

vi.mock('@helpers/town/town-tick', () => ({
  isTownDueForUpdate: vi.fn(() => true),
  markTownSubsystemProcessed: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content/content';
import { craftXpChance } from '@helpers/crafting/tradeskill';
import { newEquipmentItem } from '@helpers/item/equipment';
import { rngSucceedsChance } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import { townTradeskillLeveledUp } from '@helpers/town/crafting/town-craft-level';
import { applyTownStockAdd } from '@helpers/town/shop/town-stock';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { isTownCraftDebuffActive } from '@helpers/town/raid/town-raid-state';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import { townCraftProcessTick } from '@helpers/town/crafting/town-craft-queue';
import type {
  GameState,
  ItemId,
  RecipeContent,
  RecipeId,
  TownContent,
  TownId,
  TradeskillId,
} from '@interfaces';

const townId = 'larsia' as TownId;
const blacksmithingId = 'blacksmithing' as TradeskillId;
const woodworkingId = 'woodworking' as TradeskillId;
const oreId = 'ore' as ItemId;

function buildTown(
  crafting: Partial<TownContent['crafting']> = {},
): TownContent {
  return {
    id: townId,
    crafting: {
      maxTradeskillLevel: 20,
      maxQueueSize: 12,
      craftingDurationMultiplier: 1,
      craftingChanceOnTick: 100,
      craftingChanceItemThreshold: 4,
      ...crafting,
    },
  } as unknown as TownContent;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
  vi.mocked(isTownDueForUpdate).mockReturnValue(true);
  vi.mocked(townShopItemCap).mockReturnValue(10);
  vi.mocked(rngSucceedsChance).mockReturnValue(true);
  vi.mocked(craftXpChance).mockReturnValue(100);
  vi.mocked(townPickRecipeToQueue).mockReturnValue(undefined);
  vi.mocked(isTownCraftDebuffActive).mockReturnValue(false);
});

describe('townCraftProcessTick - due-gate', () => {
  it('skips a town that is not due for the craft subsystem', () => {
    vi.mocked(isTownDueForUpdate).mockReturnValue(false);

    townCraftProcessTick();

    expect(updateGamestate).not.toHaveBeenCalled();
    expect(markTownSubsystemProcessed).not.toHaveBeenCalled();
  });

  it('marks the subsystem processed for a due town', () => {
    townCraftProcessTick();

    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(townId, 'craft');
  });
});

describe('townCraftProcessTick - advancing the queue', () => {
  it('advances ticksIntoCraft for an entry below craftTime * craftingDurationMultiplier', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown({ craftingDurationMultiplier: 3 }),
    ]);
    vi.mocked(getEntry).mockReturnValue({ craftTime: 5 } as RecipeContent);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 3 } },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 2,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    // craftTime 5 * multiplier 3 = 15; 2 + 1 = 3, still below - stays queued, advanced by one tick.
    expect(state.world.towns[townId].craftQueue).toEqual([
      {
        id: 'q1',
        tradeskillId: blacksmithingId,
        recipeId: 'recipe-1',
        ticksIntoCraft: 3,
      },
    ]);
  });

  it('doubles craft time while the raid-loss craft debuff is active', () => {
    vi.mocked(isTownCraftDebuffActive).mockReturnValue(true);
    vi.mocked(getEntry).mockReturnValue({ craftTime: 5 } as RecipeContent);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            craftSpeedDebuffExpiresAtTick: 999,
            tradeskills: { [blacksmithingId]: { level: 3 } },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 8,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    // craftTime 5 * multiplier 1 * debuff 2 = 10; 8 + 1 = 9, still below - stays queued.
    // Without the debuff, effective craftTime would be 5 and this entry would already be complete.
    expect(state.world.towns[townId].craftQueue).toEqual([
      {
        id: 'q1',
        tradeskillId: blacksmithingId,
        recipeId: 'recipe-1',
        ticksIntoCraft: 9,
      },
    ]);
  });

  it('advances multiple queue entries together in the same tick, not one at a time', () => {
    vi.mocked(getEntry).mockReturnValue({ craftTime: 10 } as RecipeContent);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: {
              [blacksmithingId]: { level: 3 },
              [woodworkingId]: { level: 3 },
            },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'r1',
                ticksIntoCraft: 1,
              },
              {
                id: 'q2',
                tradeskillId: woodworkingId,
                recipeId: 'r2',
                ticksIntoCraft: 4,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(
      state.world.towns[townId].craftQueue.map((e) => e.ticksIntoCraft),
    ).toEqual([2, 5]);
  });

  it('drops a queue entry whose recipe no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: {},
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'gone',
                ticksIntoCraft: 0,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(state.world.towns[townId].craftQueue).toEqual([]);
  });
});

describe('townCraftProcessTick - completing the queue', () => {
  it('holds a finished craft rather than dropping it when the shop is at its stock cap', () => {
    const cappedStock = new Array(10).fill(0).map((_, i) => ({
      equipmentItem: { equipmentId: `other-${i}` } as never,
      addedAtTick: 0,
    }));
    const queue = [
      {
        id: 'q1',
        tradeskillId: blacksmithingId,
        recipeId: 'recipe-1',
        ticksIntoCraft: 4,
      },
    ];
    const recipe = {
      craftTime: 5,
      tradeskillXP: 7,
      result: { equipmentId: 'sword' },
    } as RecipeContent;
    vi.mocked(getEntry).mockReturnValue(recipe);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: cappedStock,
            tradeskills: { [blacksmithingId]: { level: 3 } },
            craftQueue: queue,
          },
        },
      },
    } as unknown as GameState);

    expect(applyTownStockAdd).not.toHaveBeenCalled();
    expect(townTradeskillLeveledUp).not.toHaveBeenCalled();
    expect(state.world.towns[townId].craftQueue).toHaveLength(1);
    expect(state.world.towns[townId].craftQueue[0].id).toBe('q1');
  });

  it('completes a craft, feeds an item result into the town materials stash, gains xp, and dequeues', () => {
    const recipe = {
      craftTime: 5,
      tradeskillXP: 7,
      result: { itemId: 'ingot' as ItemId, quantity: 2 },
    } as RecipeContent;
    vi.mocked(getEntry).mockReturnValue(recipe);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 3 } },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 4,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(townTradeskillLeveledUp).toHaveBeenCalledWith(
      expect.anything(),
      7,
      20,
    );
    expect(applyTownMaterialDelta).toHaveBeenCalledWith(
      expect.anything(),
      townId,
      'ingot',
      2,
    );
    expect(applyTownStockAdd).not.toHaveBeenCalled();
    expect(state.world.towns[townId].craftQueue).toEqual([]);
  });

  it('completes a craft with an equipment result via newEquipmentItem', () => {
    const rolledItem = { id: 'sword-1', equipmentId: 'sword' } as never;
    vi.mocked(newEquipmentItem).mockReturnValue(rolledItem);
    const recipe = {
      craftTime: 5,
      tradeskillXP: 7,
      result: { equipmentId: 'sword' },
    } as RecipeContent;
    vi.mocked(getEntry).mockReturnValue(recipe);

    townCraftProcessTick();

    applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 3 } },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 4,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(newEquipmentItem).toHaveBeenCalledWith('sword');
    expect(applyTownStockAdd).toHaveBeenCalledWith(
      expect.anything(),
      townId,
      { equipmentItem: rolledItem },
      10,
    );
  });

  it("always grants the result even when the recipe has a result chance - a town's craft never whiffs, unlike the player's", () => {
    vi.mocked(craftXpChance).mockReturnValue(100);
    // Would always fail a 25% roll if one were rolled - proves no roll happens for the result grant.
    vi.mocked(rngSucceedsChance).mockImplementation((chance) => chance !== 25);
    const recipe = {
      craftTime: 5,
      tradeskillXP: 7,
      result: { itemId: 'ingot' as ItemId, quantity: 1, chance: 25 },
    } as RecipeContent;
    vi.mocked(getEntry).mockReturnValue(recipe);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 3 } },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 4,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(applyTownMaterialDelta).toHaveBeenCalledWith(
      expect.anything(),
      townId,
      'ingot',
      1,
    );
    expect(state.world.towns[townId].craftQueue).toEqual([]);
    expect(townTradeskillLeveledUp).toHaveBeenCalled();
  });

  it('skips the xp grant (but still dequeues) once the recipe is fully outlevelled', () => {
    vi.mocked(craftXpChance).mockReturnValue(0);
    vi.mocked(rngSucceedsChance).mockReturnValue(false);
    const recipe = {
      craftTime: 5,
      tradeskillXP: 7,
      result: { itemId: 'ingot' as ItemId, quantity: 1 },
    } as RecipeContent;
    vi.mocked(getEntry).mockReturnValue(recipe);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 20 } },
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 4,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(craftXpChance).toHaveBeenCalledWith(recipe, 20);
    expect(townTradeskillLeveledUp).not.toHaveBeenCalled();
    expect(state.world.towns[townId].craftQueue).toEqual([]);
  });

  it('drops an entry defensively if its tradeskill has no live building', () => {
    const recipe = {
      craftTime: 5,
      tradeskillXP: 7,
      result: { itemId: 'ingot' as ItemId, quantity: 1 },
    } as RecipeContent;
    vi.mocked(getEntry).mockReturnValue(recipe);

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: {},
            craftQueue: [
              {
                id: 'q1',
                tradeskillId: blacksmithingId,
                recipeId: 'recipe-1',
                ticksIntoCraft: 4,
              },
            ],
          },
        },
      },
    } as unknown as GameState);

    expect(state.world.towns[townId].craftQueue).toEqual([]);
  });
});

describe('townCraftProcessTick - queueing new crafts', () => {
  it('queues a new craft when the queue is empty, without consulting craftingChanceOnTick', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown({ craftingChanceOnTick: 0, craftingChanceItemThreshold: 4 }),
    ]);
    const recipe = {
      id: 'recipe-1' as RecipeId,
      tradeskillId: blacksmithingId,
      requirements: [{ itemId: oreId, quantity: 2 }],
    } as RecipeContent;
    vi.mocked(townPickRecipeToQueue).mockReturnValue({
      tradeskillId: blacksmithingId,
      recipe,
    });

    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 5 } },
            craftQueue: [],
          },
        },
      },
    } as unknown as GameState);

    expect(rngSucceedsChance).not.toHaveBeenCalled();
    expect(applyTownMaterialDelta).toHaveBeenCalledWith(
      expect.anything(),
      townId,
      oreId,
      -2,
    );
    expect(state.world.towns[townId].craftQueue).toEqual([
      {
        id: 'queue-entry-1',
        tradeskillId: blacksmithingId,
        recipeId: 'recipe-1',
        ticksIntoCraft: 0,
      },
    ]);
  });

  it('queues every tick below craftingChanceItemThreshold, not just when empty', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown({ craftingChanceOnTick: 0, craftingChanceItemThreshold: 4 }),
    ]);
    vi.mocked(getEntry).mockReturnValue({ craftTime: 999 } as RecipeContent);
    const recipe = {
      id: 'recipe-2' as RecipeId,
      tradeskillId: blacksmithingId,
      requirements: [],
    } as unknown as RecipeContent;
    vi.mocked(townPickRecipeToQueue).mockReturnValue({
      tradeskillId: blacksmithingId,
      recipe,
    });

    townCraftProcessTick();

    const existingEntry = {
      id: 'existing',
      tradeskillId: blacksmithingId,
      recipeId: 'other-recipe',
      ticksIntoCraft: 0,
    };
    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 5 } },
            craftQueue: [existingEntry],
          },
        },
      },
    } as unknown as GameState);

    expect(state.world.towns[townId].craftQueue).toHaveLength(2);
  });

  it('gates queueing behind craftingChanceOnTick once at/above the threshold, and succeeds on a hit', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown({ craftingChanceOnTick: 42, craftingChanceItemThreshold: 1 }),
    ]);
    vi.mocked(getEntry).mockReturnValue({ craftTime: 999 } as RecipeContent);
    const recipe = {
      id: 'recipe-3' as RecipeId,
      tradeskillId: blacksmithingId,
      requirements: [],
    } as unknown as RecipeContent;
    vi.mocked(townPickRecipeToQueue).mockReturnValue({
      tradeskillId: blacksmithingId,
      recipe,
    });

    townCraftProcessTick();

    const existingEntry = {
      id: 'existing',
      tradeskillId: blacksmithingId,
      recipeId: 'other',
      ticksIntoCraft: 0,
    };
    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 5 } },
            craftQueue: [existingEntry],
          },
        },
      },
    } as unknown as GameState);

    expect(rngSucceedsChance).toHaveBeenCalledWith(42);
    expect(state.world.towns[townId].craftQueue).toHaveLength(2);
  });

  it('does not queue a new craft when the chance roll fails at/above the threshold', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown({ craftingChanceOnTick: 3, craftingChanceItemThreshold: 1 }),
    ]);
    vi.mocked(getEntry).mockReturnValue({ craftTime: 999 } as RecipeContent);
    vi.mocked(rngSucceedsChance).mockReturnValue(false);

    townCraftProcessTick();

    const existingEntry = {
      id: 'existing',
      tradeskillId: blacksmithingId,
      recipeId: 'other',
      ticksIntoCraft: 0,
    };
    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 5 } },
            craftQueue: [existingEntry],
          },
        },
      },
    } as unknown as GameState);

    expect(townPickRecipeToQueue).not.toHaveBeenCalled();
    expect(state.world.towns[townId].craftQueue).toHaveLength(1);
    expect(state.world.towns[townId].craftQueue[0].id).toBe('existing');
  });

  it('never queues past maxQueueSize', () => {
    vi.mocked(getEntriesByType).mockReturnValue([
      buildTown({
        maxQueueSize: 1,
        craftingChanceItemThreshold: 1,
        craftingChanceOnTick: 100,
      }),
    ]);
    vi.mocked(getEntry).mockReturnValue({ craftTime: 999 } as RecipeContent);

    townCraftProcessTick();

    const existingEntry = {
      id: 'existing',
      tradeskillId: blacksmithingId,
      recipeId: 'other',
      ticksIntoCraft: 0,
    };
    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            tradeskills: { [blacksmithingId]: { level: 5 } },
            craftQueue: [existingEntry],
          },
        },
      },
    } as unknown as GameState);

    expect(townPickRecipeToQueue).not.toHaveBeenCalled();
    expect(state.world.towns[townId].craftQueue).toHaveLength(1);
    expect(state.world.towns[townId].craftQueue[0].id).toBe('existing');
  });

  it('does not queue anything when no recipe is eligible', () => {
    townCraftProcessTick();

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: { stock: [], tradeskills: {}, craftQueue: [] },
        },
      },
    } as unknown as GameState);

    expect(applyTownMaterialDelta).not.toHaveBeenCalled();
    expect(state.world.towns[townId].craftQueue).toEqual([]);
  });

  it('calls townPickRecipeToQueue with the whole town content', () => {
    townCraftProcessTick();

    applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            stock: [],
            craftQueue: [],
            tradeskills: { [blacksmithingId]: { level: 5 } },
          },
        },
      },
    } as unknown as GameState);

    expect(townPickRecipeToQueue).toHaveBeenCalledWith(
      expect.objectContaining({ id: townId }),
    );
  });
});
