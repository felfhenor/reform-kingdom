import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/crafting/crafting-queue', () => ({
  craftMaxCraftableQuantity: vi.fn(() => 1),
  requirementAvailable: vi.fn(() => 0),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  isRecipeCraftable: vi.fn(() => true),
  recipeBackdropSprite: vi.fn(() => '0099'),
  recipeResultContent: vi.fn(),
  recipeResultOwnedQuantity: vi.fn(() => 0),
  recipeResultSpritesheet: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

import { getEntriesByType, getEntry } from '@helpers/content';
import {
  craftingActiveStatusEntries,
  craftQueueTicksRemaining,
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
  getCraftableRecipeEntries,
  pruneInvalidCraftQueues,
} from '@helpers/crafting/crafting';
import { craftMaxCraftableQuantity } from '@helpers/crafting/crafting-queue';
import {
  isRecipeCraftable,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
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
  TradeskillContent,
  TradeskillId,
} from '@interfaces';

const ARTIFICING_ID = 'artificing-id' as TradeskillId;
const BLACKSMITHING_ID = 'blacksmithing-id' as TradeskillId;
const JEWELCRAFTING_ID = 'jewelcrafting-id' as TradeskillId;
const TAILORING_ID = 'tailoring-id' as TradeskillId;
const WOODWORKING_ID = 'woodworking-id' as TradeskillId;

const blacksmithingContent: TradeskillContent = {
  id: BLACKSMITHING_ID,
  name: 'Blacksmithing',
  __type: 'tradeskill',
  sprite: '0001',
  description: 'Forges weapons and armor from raw ore.',
};

function buildRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    id: 'recipe-1' as RecipeId,
    name: 'Material: Copper Ingot',
    __type: 'recipe',
    result: { itemId: 'copper-ingot' as ItemId, quantity: 1 },
    requirements: [],
    tradeskillId: BLACKSMITHING_ID,
    minTradeskillLevel: 1,
    maxTradeskillLevel: 10,
    tradeskillXP: 1,
    craftTime: 5,
    tokenUnlockCost: 3,
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
    [ARTIFICING_ID]: buildBuilding(),
    [BLACKSMITHING_ID]: blacksmithing,
    [JEWELCRAFTING_ID]: buildBuilding(),
    [TAILORING_ID]: buildBuilding(),
    [WOODWORKING_ID]: buildBuilding(),
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
    vi.mocked(getEntry).mockImplementation((key: string) =>
      key === 'Blacksmithing' ? (blacksmithingContent as never) : undefined,
    );
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

  it('sorts by level regardless of craftability, so order stays stable as craftability changes', () => {
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
        minTradeskillLevel: 3,
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
      'unaffordable',
      'free',
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

  it("sorts by the recipe's own minTradeskillLevel, ignoring the result item's (possibly different) level requirement", () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 20 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({
        id: 'same-tier-high-equip-level' as RecipeId,
        name: 'Coppersilk Robe',
        minTradeskillLevel: 4,
      }),
      buildRecipe({
        id: 'same-tier-low-equip-level' as RecipeId,
        name: 'Bone-Hewn Cloak',
        minTradeskillLevel: 4,
      }),
    ]);
    vi.mocked(recipeResultContent).mockImplementation(
      (recipe) =>
        ({
          levelRequirement: recipe.id === 'same-tier-high-equip-level' ? 6 : 4,
          rarity: 'Common',
        }) as never,
    );

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries.map((entry) => entry.recipe.id)).toEqual([
      'same-tier-low-equip-level',
      'same-tier-high-equip-level',
    ]);
  });

  it('breaks ties at the same minTradeskillLevel by rarity, then name', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding({ level: 20 })),
    } as unknown as GameState);
    vi.mocked(getEntriesByType).mockReturnValue([
      buildRecipe({
        id: 'rare-z' as RecipeId,
        name: 'Z - Rare',
        minTradeskillLevel: 4,
      }),
      buildRecipe({
        id: 'common-a' as RecipeId,
        name: 'A - Common',
        minTradeskillLevel: 4,
      }),
      buildRecipe({
        id: 'common-b' as RecipeId,
        name: 'B - Common',
        minTradeskillLevel: 4,
      }),
    ]);
    vi.mocked(recipeResultContent).mockImplementation(
      (recipe) =>
        ({ rarity: recipe.id === 'rare-z' ? 'Rare' : 'Common' }) as never,
    );

    const entries = getCraftableRecipeEntries('Blacksmithing');
    expect(entries.map((entry) => entry.recipe.id)).toEqual([
      'common-a',
      'common-b',
      'rare-z',
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
      if (id === 'Blacksmithing') return blacksmithingContent as never;
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

describe('craftingActiveStatusEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockImplementation((key: string) => {
      if (key === 'Blacksmithing') return blacksmithingContent as never;
      if (key === 'recipe-1') {
        return buildRecipe({
          name: 'Material: Copper Ingot',
          craftTime: 10,
        }) as never;
      }
      if (key === 'recipe-2') {
        return buildRecipe({
          name: 'Material: Tin Ingot',
          craftTime: 20,
        }) as never;
      }
      return undefined;
    });
    vi.mocked(recipeResultSpritesheet).mockReturnValue('item');
    vi.mocked(recipeResultContent).mockReturnValue({
      sprite: 'copper-ingot-sprite',
    } as never);
  });

  it('includes only tradeskills with an active queue, stripping the "Category: " prefix from the head entry\'s recipe name', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({
          queue: [
            buildQueueEntry({
              recipeId: 'recipe-1' as RecipeId,
              ticksIntoCraft: 4,
            }),
          ],
        }),
      ),
    } as unknown as GameState);

    // Remaining: craftTime (10) - ticksIntoCraft (4) = 6, single unit queued.
    expect(craftingActiveStatusEntries()).toEqual([
      {
        tradeskillId: BLACKSMITHING_ID,
        tradeskill: 'Blacksmithing',
        itemName: 'Copper Ingot',
        resultSpritesheet: 'item',
        resultSprite: 'copper-ingot-sprite',
        remainingTicks: 6,
      },
    ]);
  });

  it('returns nothing when every tradeskill queue is empty', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding()),
    } as unknown as GameState);

    expect(craftingActiveStatusEntries()).toEqual([]);
  });

  it('reports the whole queue\'s remaining time, not just the head entry\'s, when a second recipe is queued behind it', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({
          queue: [
            buildQueueEntry({
              id: 'entry-1' as CraftQueueEntryId,
              recipeId: 'recipe-1' as RecipeId,
              ticksIntoCraft: 4,
            }),
            buildQueueEntry({
              id: 'entry-2' as CraftQueueEntryId,
              recipeId: 'recipe-2' as RecipeId,
              ticksIntoCraft: 0,
            }),
          ],
        }),
      ),
    } as unknown as GameState);

    // Head entry remainder (10-4=6) + the fully-queued second entry (20) = 26.
    expect(craftingActiveStatusEntries()[0].remainingTicks).toBe(26);
  });
});

describe('pruneInvalidCraftQueues', () => {
  it('drops queue entries whose recipeId no longer resolves to real content', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const tradeskills: GameStateTradeskills = {
      [ARTIFICING_ID]: buildBuilding(),
      [BLACKSMITHING_ID]: buildBuilding({ queue: [buildQueueEntry()] }),
      [JEWELCRAFTING_ID]: buildBuilding(),
      [TAILORING_ID]: buildBuilding(),
      [WOODWORKING_ID]: buildBuilding(),
    };

    const result = pruneInvalidCraftQueues(tradeskills);
    expect(result[BLACKSMITHING_ID].queue).toEqual([]);
  });
});
