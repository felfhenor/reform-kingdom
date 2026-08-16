import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/crafting-queue', () => ({
  craftMaxCraftableQuantity: vi.fn(() => 1),
  requirementAvailable: vi.fn(() => 0),
}));

vi.mock('@helpers/recipes', () => ({
  isRecipeCraftable: vi.fn(() => true),
  recipeBackdropSprite: vi.fn(() => '0099'),
  recipeResultContent: vi.fn(),
  recipeResultOwnedQuantity: vi.fn(() => 0),
  recipeResultSpritesheet: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  craftQueueTicksRemaining,
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
  getCraftableRecipeEntries,
  pruneInvalidCraftQueues,
} from '@helpers/crafting';
import { craftMaxCraftableQuantity } from '@helpers/crafting-queue';
import {
  isRecipeCraftable,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/recipes';
import { gamestate } from '@helpers/state-game';
import type {
  CraftQueueEntry,
  CraftQueueEntryId,
  EquipmentId,
  GameState,
  GameStateTradeskills,
  ItemId,
  RecipeContent,
  RecipeId,
  TradeskillBuildingState,
} from '@interfaces';

function buildRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    id: 'recipe-1' as RecipeId,
    name: 'Material: Copper Ingot',
    __type: 'recipe',
    result: { itemId: 'copper-ingot' as ItemId, quantity: 1 },
    requirements: [],
    tradeskill: 'Blacksmithing',
    minTradeskillLevel: 1,
    maxTradeskillLevel: 10,
    tradeskillXP: 1,
    craftTime: 5,
    ...overrides,
  };
}

function buildBuilding(
  overrides: Partial<TradeskillBuildingState> = {},
): TradeskillBuildingState {
  return {
    level: 1,
    xp: { current: 0, maximum: 10 },
    queue: [],
    ...overrides,
  };
}

function buildAllTradeskills(
  blacksmithing: TradeskillBuildingState,
): GameStateTradeskills {
  return {
    Artificing: buildBuilding(),
    Blacksmithing: blacksmithing,
    Jewelcrafting: buildBuilding(),
    Tailoring: buildBuilding(),
    Woodworking: buildBuilding(),
  };
}

function buildQueueEntry(
  overrides: Partial<CraftQueueEntry> = {},
): CraftQueueEntry {
  return {
    id: 'queue-entry-1' as CraftQueueEntryId,
    recipeId: 'recipe-1' as RecipeId,
    quantityTotal: 1,
    quantityCompleted: 0,
    ticksIntoCraft: 0,
    ...overrides,
  };
}

describe('getCraftableRecipeEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recipeResultSpritesheet).mockReturnValue('item');
    vi.mocked(recipeResultContent).mockReturnValue(undefined);
    vi.mocked(isRecipeCraftable).mockReturnValue(true);
  });

  it('only includes recipes the building has actually reached', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 2 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({
        id: 'low' as RecipeId,
        name: 'Low',
        minTradeskillLevel: 1,
      }),
      buildRecipe({
        id: 'high' as RecipeId,
        name: 'High',
        minTradeskillLevel: 3,
      }),
    ]);

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries.map((entry) => entry.recipe.id)).toEqual(['low']);
  });

  it('excludes a level-gated recipe that also requires a world drop until discovered', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 5 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({ id: 'undiscovered' as RecipeId, name: 'Undiscovered' }),
      buildRecipe({ id: 'discovered' as RecipeId, name: 'Discovered' }),
    ]);
    vi.mocked(isRecipeCraftable).mockImplementation(
      (recipeId) => recipeId !== 'undiscovered',
    );

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries.map((entry) => entry.recipe.id)).toEqual(['discovered']);
  });

  it('sorts uncraftable entries to the bottom', () => {
    vi.mocked(craftMaxCraftableQuantity).mockImplementation((recipe) =>
      recipe.id === 'unaffordable' ? 0 : 1,
    );
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 5 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({
        id: 'unaffordable' as RecipeId,
        name: 'A - Unaffordable',
        minTradeskillLevel: 1,
        requirements: [{ itemId: 'ore' as ItemId, quantity: 1 }],
      }),
      buildRecipe({
        id: 'free' as RecipeId,
        name: 'Z - Free',
        minTradeskillLevel: 1,
        requirements: [],
      }),
    ]);

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries.map((entry) => entry.recipe.id)).toEqual([
      'free',
      'unaffordable',
    ]);
  });

  it('sorts by level descending', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 20 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({
        id: 'low' as RecipeId,
        name: 'Low',
        minTradeskillLevel: 1,
      }),
      buildRecipe({
        id: 'high' as RecipeId,
        name: 'High',
        minTradeskillLevel: 11,
      }),
      buildRecipe({
        id: 'mid' as RecipeId,
        name: 'Mid',
        minTradeskillLevel: 5,
      }),
    ]);

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries.map((entry) => entry.recipe.id)).toEqual([
      'high',
      'mid',
      'low',
    ]);
  });

  it('orders requirement entries collectible, then equipment, then item', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 5 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({
        minTradeskillLevel: 1,
        requirements: [
          { itemId: 'ore' as ItemId, quantity: 3 },
          { equipmentId: 'hammer' as EquipmentId },
          { collectibleId: 'tool' as never },
        ],
      }),
    ]);

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries[0].requirementEntries.map((entry) => entry.kind)).toEqual([
      'collectible',
      'equipment',
      'item',
    ]);
  });
});

describe('craftQueueTicksRemaining / craftQueueTotalTicks / craftQueueUnitsRemaining', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Two batches: 3 ore left in an in-progress batch of 5 (craftTime 10),
    // plus a fresh batch of 2 rings (craftTime 20) not yet started.
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({
          queue: [
            buildQueueEntry({
              id: 'entry-ore' as CraftQueueEntryId,
              recipeId: 'ore-recipe' as RecipeId,
              quantityTotal: 5,
              quantityCompleted: 2,
              ticksIntoCraft: 4,
            }),
            buildQueueEntry({
              id: 'entry-ring' as CraftQueueEntryId,
              recipeId: 'ring-recipe' as RecipeId,
              quantityTotal: 2,
              quantityCompleted: 0,
              ticksIntoCraft: 0,
            }),
          ],
        }),
      ),
    } as unknown as GameState);
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'ore-recipe') return buildRecipe({ craftTime: 10 }) as never;
      if (id === 'ring-recipe') return buildRecipe({ craftTime: 20 }) as never;
      return undefined;
    });
  });

  it('sums remaining ticks: the active unit remainder + every not-yet-started unit', () => {
    // Ore: (10-4) + (5-2-1)*10 = 6 + 20 = 26. Ring: 2*20 = 40. Total 66.
    expect(craftQueueTicksRemaining('Blacksmithing')).toBe(66);
  });

  it('sums the total ticks the whole queue will ever take', () => {
    // Ore: 5*10 = 50. Ring: 2*20 = 40. Total 90.
    expect(craftQueueTotalTicks('Blacksmithing')).toBe(90);
  });

  it('sums individual units still to be crafted, not the number of queue slots', () => {
    // Ore: 5-2 = 3 remaining. Ring: 2-0 = 2 remaining. Total 5, across 2 slots.
    expect(craftQueueUnitsRemaining('Blacksmithing')).toBe(5);
  });
});

describe('pruneInvalidCraftQueues', () => {
  it('drops queue entries whose recipeId no longer resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const tradeskills: GameStateTradeskills = {
      Artificing: buildBuilding(),
      Blacksmithing: buildBuilding({ queue: [buildQueueEntry()] }),
      Jewelcrafting: buildBuilding(),
      Tailoring: buildBuilding(),
      Woodworking: buildBuilding(),
    };

    const result = pruneInvalidCraftQueues(tradeskills);
    expect(result.Blacksmithing.queue).toEqual([]);
  });
});
