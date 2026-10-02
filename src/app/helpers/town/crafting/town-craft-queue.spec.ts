import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/crafting/town-craft-pick');
vi.mock('@helpers/rng', async (importOriginal) => ({
  ...(await importOriginal<typeof RngHelper>()),
  rngSucceedsChance: vi.fn(() => true),
}));

import { CRAFT_TICK_INTERVAL } from '@helpers/config';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import { rngSucceedsChance } from '@helpers/rng';
import {
  gamestate,
  updateGamestate,
  worldTownsState,
} from '@helpers/state-game';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import {
  townCompleteInitialCrafts,
  townCraftProcessTick,
  townQueueInitialCrafts,
} from '@helpers/town/crafting/town-craft-queue';
import { townCraftTimeFor } from '@helpers/town/crafting/town-craft-time';
import type {
  CraftQueueEntryId,
  EquipmentId,
  GameState,
  ItemId,
  RecipeContent,
  RecipeId,
  TownContent,
  TownCraftQueueEntry,
  TownId,
  TownNodeState,
  TradeskillId,
} from '@interfaces';
import { buildEquipmentItem, buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const townId = 'larsia' as TownId;
const blacksmithingId = 'blacksmithing' as TradeskillId;
const woodworkingId = 'woodworking' as TradeskillId;
const oreId = 'ore' as ItemId;
const ingotId = 'ingot' as ItemId;
const swordId = 'sword' as EquipmentId;
const SHOP_CAP = 10;

const ingotRecipe = ensureRecipe({
  id: 'recipe-ingot' as RecipeId,
  tradeskillId: blacksmithingId,
  requirements: [{ itemId: oreId, quantity: 2 }],
  result: { itemId: ingotId, quantity: 2 },
  craftTime: 100,
});
const swordRecipe = ensureRecipe({
  id: 'recipe-sword' as RecipeId,
  tradeskillId: blacksmithingId,
  requirements: [{ itemId: oreId, quantity: 2 }],
  result: { equipmentId: swordId },
  craftTime: 100,
});

function seedTown(
  crafting: Partial<TownContent['crafting']> = {},
): TownContent {
  const town = ensureTown({
    id: townId,
    name: 'Larsia',
    crafting: {
      maxQueueSize: [{ tier: 0, value: 12 }],
      craftingChanceOnTick: 100,
      craftingChanceItemThreshold: 4,
      ...crafting,
    } as TownContent['crafting'],
    traders: {
      sellItemCount: [{ tier: 0, value: SHOP_CAP }],
    } as TownContent['traders'],
  });
  seedContent([
    town,
    ingotRecipe,
    swordRecipe,
    ensureItem({ id: oreId, name: 'Ore' }),
    ensureItem({ id: ingotId, name: 'Ingot' }),
    ensureEquipment({ id: swordId, name: 'Sword' }),
  ]);
  return town;
}

function seedTownState(
  townState: Partial<TownNodeState> = {},
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.world.towns[townId] = buildTownNodeState({
      tradeskills: {
        [blacksmithingId]: { level: 3 },
        [woodworkingId]: { level: 3 },
      },
      materials: { [oreId]: 100 },
      ...townState,
    });
    edit?.(state);
  });
}

function queued(
  overrides: Partial<TownCraftQueueEntry> = {},
): TownCraftQueueEntry {
  return {
    id: 'q1' as CraftQueueEntryId,
    tradeskillId: blacksmithingId,
    recipeId: ingotRecipe.id,
    ticksIntoCraft: 0,
    ...overrides,
  };
}

function fullStock(): TownNodeState['stock'] {
  return Array.from({ length: SHOP_CAP }, () => ({
    equipmentItem: buildEquipmentItem(swordId),
    addedAtTick: 0,
  }));
}

function craftTime(recipe: RecipeContent, town: TownContent, level = 3) {
  return townCraftTimeFor(recipe, town, level);
}

function town(): TownNodeState {
  return worldTownsState()[townId];
}

// Advances the clock first, so a repeated tick is always due whatever the craft interval.
function processTick(): void {
  inTick(() => {
    updateGamestate((state) => {
      state.clock.numTicks += CRAFT_TICK_INTERVAL;
      return state;
    });
    townCraftProcessTick();
  });
}

function pickReturns(recipe: RecipeContent | undefined): void {
  vi.mocked(townPickRecipeToQueue).mockReturnValue(
    recipe ? { tradeskillId: recipe.tradeskillId, recipe } : undefined,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rngSucceedsChance).mockReturnValue(true);
  pickReturns(undefined);
});

describe('townCraftProcessTick - due-gate', () => {
  it('skips a town that was processed within the craft interval', () => {
    seedTown();
    seedTownState({ craftQueue: [queued()] }, (state) => {
      state.clock.numTicks = 1000;
      state.world.towns[townId].lastProcessedTick.craft = 1000;
    });

    inTick(townCraftProcessTick);

    expect(town().craftQueue[0].ticksIntoCraft).toBe(0);
  });

  it('processes a town once the craft interval has elapsed', () => {
    seedTown();
    seedTownState({ craftQueue: [queued()] }, (state) => {
      state.clock.numTicks = 1000;
      state.world.towns[townId].lastProcessedTick.craft =
        1000 - CRAFT_TICK_INTERVAL;
    });

    inTick(townCraftProcessTick);

    expect(town().craftQueue[0].ticksIntoCraft).toBe(1);
  });

  it('ignores a town that has never been visited', () => {
    seedTown();
    const before = seedGamestate();

    processTick();

    expect(gamestate().world.towns).toBe(before.world.towns);
  });
});

describe('townCraftProcessTick - advancing the queue', () => {
  it('advances every queued entry together in the same tick', () => {
    seedTown();
    seedTownState({
      craftQueue: [
        queued({ ticksIntoCraft: 1 }),
        queued({
          id: 'q2' as CraftQueueEntryId,
          tradeskillId: woodworkingId,
          ticksIntoCraft: 4,
        }),
      ],
    });

    processTick();

    expect(town().craftQueue.map((entry) => entry.ticksIntoCraft)).toEqual([
      2, 5,
    ]);
  });

  it('scales craft time by the town duration multiplier', () => {
    const slowTown = seedTown({ craftingDurationMultiplier: 3 });
    const normalTime = craftTime(ingotRecipe, {
      ...slowTown,
      crafting: { ...slowTown.crafting, craftingDurationMultiplier: 1 },
    });
    seedTownState({ craftQueue: [queued({ ticksIntoCraft: normalTime })] });

    processTick();

    expect(town().craftQueue).toHaveLength(1);
  });

  it('slows crafting while the raid-loss craft debuff is active', () => {
    const content = seedTown();
    seedTownState(
      {
        craftQueue: [
          queued({ ticksIntoCraft: craftTime(ingotRecipe, content) }),
        ],
        craftSpeedDebuffExpiresAtTick: 999,
      },
      (state) => (state.clock.numTicks = 10),
    );

    processTick();

    expect(town().craftQueue).toHaveLength(1);
  });

  it('a higher tradeskill level shortens the effective craft time', () => {
    const content = seedTown();
    const ticks = craftTime(ingotRecipe, content, 50) - 1;
    seedTownState({
      tradeskills: { [blacksmithingId]: { level: 50 } },
      craftQueue: [queued({ ticksIntoCraft: ticks })],
    });

    processTick();

    expect(ticks).toBeLessThan(craftTime(ingotRecipe, content, 1) - 1);
    expect(town().craftQueue).toEqual([]);
  });

  it('drops a queue entry whose recipe no longer resolves', () => {
    seedTown();
    seedTownState({
      craftQueue: [queued({ recipeId: 'gone' as RecipeId })],
    });

    processTick();

    expect(town().craftQueue).toEqual([]);
  });

  it('drops a finished entry defensively if its tradeskill has no live building', () => {
    const content = seedTown();
    seedTownState({
      tradeskills: {},
      craftQueue: [
        queued({ ticksIntoCraft: craftTime(ingotRecipe, content, 1) }),
      ],
    });

    processTick();

    expect(town().craftQueue).toEqual([]);
    expect(town().materials[ingotId]).toBeUndefined();
  });
});

describe('townCraftProcessTick - completing the queue', () => {
  function finishedEntry(content: TownContent, recipe: RecipeContent) {
    return queued({
      recipeId: recipe.id,
      ticksIntoCraft: craftTime(recipe, content) - 1,
    });
  }

  it('feeds an item result into the town materials, resets its specialty priority, and dequeues', () => {
    const content = seedTown();
    seedTownState({
      craftQueue: [finishedEntry(content, ingotRecipe)],
      specialtyPriority: [{ recipeId: ingotRecipe.id, failureCount: 3 }],
    });

    processTick();

    expect(town().materials[ingotId]).toBe(2);
    expect(town().stock).toEqual([]);
    expect(town().specialtyPriority).toEqual([]);
    expect(town().craftQueue).toEqual([]);
  });

  it('puts an equipment result into the shop stock', () => {
    const content = seedTown();
    seedTownState({ craftQueue: [finishedEntry(content, swordRecipe)] });

    processTick();

    expect(
      town().stock.map((entry) => entry.equipmentItem.equipmentId),
    ).toEqual([swordId]);
  });

  it('holds a finished equipment craft while the shop is at its stock cap', () => {
    const content = seedTown();
    seedTownState({
      stock: fullStock(),
      craftQueue: [finishedEntry(content, swordRecipe)],
    });

    processTick();
    processTick();

    expect(town().stock).toHaveLength(SHOP_CAP);
    expect(town().craftQueue.map((entry) => entry.id)).toEqual(['q1']);
  });

  it("always grants the result, ignoring the recipe's result chance", () => {
    const chanceRecipe = ensureRecipe({
      ...ingotRecipe,
      result: { itemId: ingotId, quantity: 1, chance: 25 },
    });
    const content = seedTown();
    seedContent([content, chanceRecipe, ensureItem({ id: ingotId })]);
    seedTownState({ craftQueue: [finishedEntry(content, chanceRecipe)] });
    vi.mocked(rngSucceedsChance).mockImplementation((chance) => chance !== 25);

    processTick();

    expect(town().materials[ingotId]).toBe(1);
  });
});

describe('townCraftProcessTick - queueing new crafts', () => {
  function existingEntries(count: number): TownCraftQueueEntry[] {
    return Array.from({ length: count }, (_, i) =>
      queued({ id: `existing-${i}` as CraftQueueEntryId }),
    );
  }

  it('queues the picked recipe into an empty queue, consuming its materials, without rolling', () => {
    const content = seedTown({
      craftingChanceOnTick: 0,
      craftingChanceItemThreshold: 0,
    });
    seedTownState();
    pickReturns(ingotRecipe);

    processTick();

    expect(townPickRecipeToQueue).toHaveBeenCalledWith(content);
    expect(rngSucceedsChance).not.toHaveBeenCalled();
    expect(town().materials[oreId]).toBe(98);
    expect(town().craftQueue).toEqual([
      expect.objectContaining({
        tradeskillId: blacksmithingId,
        recipeId: ingotRecipe.id,
        ticksIntoCraft: 0,
      }),
    ]);
  });

  it('queues every tick below craftingChanceItemThreshold, not just when empty', () => {
    seedTown({ craftingChanceOnTick: 0, craftingChanceItemThreshold: 4 });
    seedTownState({ craftQueue: existingEntries(1) });
    pickReturns(swordRecipe);

    processTick();

    expect(rngSucceedsChance).not.toHaveBeenCalled();
    expect(town().craftQueue).toHaveLength(2);
  });

  it('gates queueing behind craftingChanceOnTick once at/above the threshold', () => {
    seedTown({ craftingChanceOnTick: 42, craftingChanceItemThreshold: 1 });
    seedTownState({ craftQueue: existingEntries(1) });
    pickReturns(swordRecipe);

    processTick();
    expect(rngSucceedsChance).toHaveBeenCalledWith(42);
    expect(town().craftQueue).toHaveLength(2);

    vi.mocked(rngSucceedsChance).mockReturnValue(false);
    processTick();
    expect(town().craftQueue).toHaveLength(2);
  });

  it('never queues past the max queue size', () => {
    seedTown({ maxQueueSize: [{ tier: 0, value: 1 }] });
    seedTownState({ craftQueue: existingEntries(1) });
    pickReturns(swordRecipe);

    processTick();

    expect(townPickRecipeToQueue).not.toHaveBeenCalled();
    expect(town().craftQueue).toHaveLength(1);
  });

  it('queues nothing and consumes nothing when no recipe is eligible', () => {
    seedTown();
    seedTownState();

    processTick();

    expect(town().craftQueue).toEqual([]);
    expect(town().materials[oreId]).toBe(100);
  });
});

describe('townQueueInitialCrafts', () => {
  function queueInitial(content: TownContent, count: number): TownNodeState {
    seedGamestate((state) => {
      state.world.towns[townId] = buildTownNodeState({
        materials: { [oreId]: 100 },
      });
    });
    inTick(() =>
      updateGamestate((state) => {
        townQueueInitialCrafts(state, content, count);
        return state;
      }),
    );
    return town();
  }

  it('queues the requested count without rolling craftingChanceOnTick', () => {
    const content = seedTown({ craftingChanceOnTick: 0 });
    pickReturns(ingotRecipe);

    const result = queueInitial(content, 4);

    expect(rngSucceedsChance).not.toHaveBeenCalled();
    expect(result.craftQueue).toHaveLength(4);
    expect(result.materials[oreId]).toBe(92);
  });

  it('stops at the max queue size', () => {
    const content = seedTown({ maxQueueSize: [{ tier: 0, value: 2 }] });
    pickReturns(ingotRecipe);

    expect(queueInitial(content, 4).craftQueue).toHaveLength(2);
  });

  it('stops early once no recipe is eligible', () => {
    const content = seedTown();
    vi.mocked(townPickRecipeToQueue)
      .mockReturnValueOnce({
        tradeskillId: blacksmithingId,
        recipe: ingotRecipe,
      })
      .mockReturnValue(undefined);

    expect(queueInitial(content, 4).craftQueue).toHaveLength(1);
    expect(townPickRecipeToQueue).toHaveBeenCalledTimes(2);
  });
});

describe('townCompleteInitialCrafts', () => {
  function completeInitial(
    content: TownContent,
    count: number,
    stock: TownNodeState['stock'] = [],
  ): TownNodeState {
    seedGamestate((state) => {
      state.world.towns[townId] = buildTownNodeState({
        materials: { [oreId]: 100 },
        stock,
        specialtyPriority: [{ recipeId: swordRecipe.id, failureCount: 2 }],
      });
    });
    inTick(() =>
      updateGamestate((state) => {
        townCompleteInitialCrafts(state, content, count);
        return state;
      }),
    );
    return town();
  }

  it('only asks the pick for equipment recipes', () => {
    completeInitial(seedTown(), 1);

    const accept = vi.mocked(townPickRecipeToQueue).mock.calls[0][1]!;
    expect(accept(swordRecipe)).toBe(true);
    expect(accept(ingotRecipe)).toBe(false);
  });

  it('consumes requirements and puts the results straight into stock', () => {
    pickReturns(swordRecipe);

    const result = completeInitial(seedTown(), 2);

    expect(result.materials[oreId]).toBe(96);
    expect(result.stock).toHaveLength(2);
    expect(result.specialtyPriority).toEqual([]);
    expect(result.craftQueue).toEqual([]);
  });

  it('stops once the shop stock is full', () => {
    pickReturns(swordRecipe);

    const result = completeInitial(seedTown(), 4, fullStock());

    expect(result.stock).toHaveLength(SHOP_CAP);
    expect(result.materials[oreId]).toBe(100);
  });

  it('stops early once no recipe is eligible', () => {
    vi.mocked(townPickRecipeToQueue)
      .mockReturnValueOnce({
        tradeskillId: blacksmithingId,
        recipe: swordRecipe,
      })
      .mockReturnValue(undefined);

    expect(completeInitial(seedTown(), 4).stock).toHaveLength(1);
    expect(townPickRecipeToQueue).toHaveBeenCalledTimes(2);
  });
});
