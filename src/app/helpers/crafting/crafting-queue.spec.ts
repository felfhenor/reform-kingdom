import type * as AnalyticsHelper from '@helpers/engine/analytics';
import type * as MaterialsHelper from '@helpers/item/materials';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/kingdom/armory', () => ({
  armoryAdd: vi.fn(),
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/item/collectibles', () => ({
  collectiblesAdd: vi.fn(),
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  craftMessageLog: vi.fn(),
  itemDropHtml: vi.fn(
    (item: { name: string }, quantity: number) =>
      `${quantity} <colored>${item.name}</colored>`,
  ),
  equipmentDropHtml: vi.fn(
    (equipment: { name: string }) => `<colored>${equipment.name}</colored>`,
  ),
  collectibleDropHtml: vi.fn(
    (collectible: { name: string }) => `<colored>${collectible.name}</colored>`,
  ),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/item/materials', async (importOriginal) => {
  const actual = await importOriginal<typeof MaterialsHelper>();
  return {
    ...actual,
    addMaterial: vi.fn(),
    getMaterialQuantity: vi.fn(() => 0),
  };
});

vi.mock('@helpers/crafting/recipes', () => ({
  isRecipeCraftable: vi.fn(() => true),
}));

vi.mock('@helpers/rng', () => ({
  rngSucceedsChance: vi.fn(() => true),
  rngUuid: vi.fn(() => 'queue-entry-1'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { craftMessageLog } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content';
import {
  craftMaxCraftableQuantity,
  craftProcessTick,
  craftQueueRemove,
  craftQueueStart,
} from '@helpers/crafting/crafting-queue';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  collectiblesAdd,
  isCollectibleDiscovered,
} from '@helpers/item/collectibles';
import { addMaterial, getMaterialQuantity } from '@helpers/item/materials';
import { armoryAdd, armoryGet } from '@helpers/kingdom/armory';
import { rngSucceedsChance } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
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
const woodworkingContent: TradeskillContent = {
  id: WOODWORKING_ID,
  name: 'Woodworking',
  __type: 'tradeskill',
  sprite: '0004',
  description: 'Shapes timber into tools and fittings.',
};

const TRADESKILL_CONTENT_BY_KEY: Record<string, TradeskillContent> = {
  Blacksmithing: blacksmithingContent,
  [BLACKSMITHING_ID]: blacksmithingContent,
  Woodworking: woodworkingContent,
  [WOODWORKING_ID]: woodworkingContent,
};

// `getEntry` resolves both recipe/item lookups (by whatever id/name a test
// supplies in `byKey`) and tradeskill name<->id lookups off the same mocked
// function, mirroring how the real content map works.
function mockGetEntry(byKey: Record<string, unknown> = {}): void {
  vi.mocked(getEntry).mockImplementation((key: string) => {
    if (key in byKey) return byKey[key] as never;
    if (key in TRADESKILL_CONTENT_BY_KEY) {
      return TRADESKILL_CONTENT_BY_KEY[key] as never;
    }
    return undefined as never;
  });
}

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

function applyUpdateAt(index: number, state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[index][0];
  return updateFn(state);
}

describe('craftMaxCraftableQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEntry();
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(buildBuilding()),
    } as unknown as GameState);
  });

  it('is uncapped (up to the sane ceiling) with no requirements', () => {
    expect(
      craftMaxCraftableQuantity(
        buildRecipe({ requirements: [] }),
        'Blacksmithing',
      ),
    ).toBe(99);
  });

  it('takes the minimum across every item requirement', () => {
    vi.mocked(getMaterialQuantity).mockImplementation((itemId: string) =>
      itemId === 'ore' ? 10 : 3,
    );

    const recipe = buildRecipe({
      requirements: [
        { itemId: 'ore' as ItemId, quantity: 2 },
        { itemId: 'ingot' as ItemId, quantity: 1 },
      ],
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(3);
  });

  it('counts equipment requirements from the armory', () => {
    vi.mocked(armoryGet).mockReturnValue([
      { equipmentId: 'dagger' as EquipmentId },
      { equipmentId: 'dagger' as EquipmentId },
    ]);

    const recipe = buildRecipe({
      requirements: [{ equipmentId: 'dagger' as EquipmentId }],
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(2);
  });

  it('is 0 when a collectible requirement (a possession gate) is not owned', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);

    const recipe = buildRecipe({
      requirements: [{ collectibleId: 'tool' as never }],
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(0);
  });

  it('ignores an owned collectible requirement in the resource math (never consumed)', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);

    const recipe = buildRecipe({
      requirements: [{ collectibleId: 'tool' as never }],
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(99);
  });

  it('caps a unique-collectible result to 1 even with abundant resources', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(500);
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);

    const recipe = buildRecipe({
      requirements: [{ itemId: 'ore' as ItemId, quantity: 1 }],
      result: { collectibleId: 'effigy' as never },
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(1);
  });

  it('is 0 for a unique-collectible result that is already owned', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);

    const recipe = buildRecipe({
      result: { collectibleId: 'effigy' as never },
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(0);
  });

  it('is 0 for a unique-collectible result that is already queued', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({
          queue: [buildQueueEntry({ recipeId: 'recipe-1' as RecipeId })],
        }),
      ),
    } as unknown as GameState);

    const recipe = buildRecipe({
      id: 'recipe-1' as RecipeId,
      result: { collectibleId: 'effigy' as never },
    });

    expect(craftMaxCraftableQuantity(recipe, 'Blacksmithing')).toBe(0);
  });
});

describe('craftQueueStart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMaterialQuantity).mockReturnValue(100);
  });

  it('fails when the recipe does not belong to the tradeskill', () => {
    mockGetEntry({
      'recipe-1': buildRecipe({ tradeskillId: WOODWORKING_ID }),
    });

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 1)).toBe(
      false,
    );
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the building has not reached the recipe level yet', () => {
    mockGetEntry({ 'recipe-1': buildRecipe({ minTradeskillLevel: 5 }) });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { [BLACKSMITHING_ID]: buildBuilding({ level: 1 }) },
    } as unknown as GameState);

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 1)).toBe(
      false,
    );
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the queue is already full', () => {
    mockGetEntry({ 'recipe-1': buildRecipe() });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: {
        [BLACKSMITHING_ID]: buildBuilding({
          level: 1,
          queue: [
            buildQueueEntry(),
            buildQueueEntry({ id: 'queue-entry-2' as CraftQueueEntryId }),
          ],
        }),
      },
    } as unknown as GameState);

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 1)).toBe(
      false,
    );
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('clamps the requested quantity to what is craftable and reserves materials', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(6);
    mockGetEntry({
      'recipe-1': buildRecipe({
        requirements: [{ itemId: 'ore' as ItemId, quantity: 2 }],
      }),
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { [BLACKSMITHING_ID]: buildBuilding({ level: 1 }) },
    } as unknown as GameState);

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 10)).toBe(
      true,
    );

    const state: GameState = {
      materials: { ore: { quantity: 6, foundAt: 1000 } },
      discoveredMaterials: {},
      tradeskills: { [BLACKSMITHING_ID]: buildBuilding({ level: 1 }) },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    expect(result.materials['ore' as ItemId]).toBeUndefined();
    expect(result.tradeskills[BLACKSMITHING_ID].queue).toEqual([
      {
        id: 'queue-entry-1',
        recipeId: 'recipe-1',
        quantityTotal: 3,
        quantityCompleted: 0,
        ticksIntoCraft: 0,
      },
    ]);
  });

  it('sends an analytics event with the recipe name when a craft is queued', () => {
    mockGetEntry({ 'recipe-1': buildRecipe({ name: 'Copper Ingot' }) });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { [BLACKSMITHING_ID]: buildBuilding({ level: 1 }) },
    } as unknown as GameState);

    craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 1);

    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Kingdom:Craft:Queue:Copper Ingot',
    );
  });
});

describe('craftQueueRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refunds only the unconsumed remainder and drops the entry', () => {
    mockGetEntry({
      'recipe-1': buildRecipe({
        requirements: [{ itemId: 'ore' as ItemId, quantity: 2 }],
      }),
    });

    craftQueueRemove('Blacksmithing', 'queue-entry-1' as CraftQueueEntryId);

    const state: GameState = {
      materials: {},
      discoveredMaterials: {},
      tradeskills: {
        [BLACKSMITHING_ID]: buildBuilding({
          queue: [buildQueueEntry({ quantityTotal: 5, quantityCompleted: 2 })],
        }),
      },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    // 3 units unconsumed * 2 ore per unit = 6 refunded.
    expect(result.materials['ore' as ItemId].quantity).toBe(6);
    expect(result.tradeskills[BLACKSMITHING_ID].queue).toEqual([]);
  });
});

describe('craftProcessTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accumulates ticks without resolving until craftTime is reached', () => {
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 2 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({ 'recipe-1': buildRecipe({ craftTime: 5 }) });

    craftProcessTick();

    expect(addMaterial).not.toHaveBeenCalled();
    expect(updateGamestate).toHaveBeenCalledTimes(1);

    const state: GameState = {
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 2 })] }),
      ),
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);
    expect(result.tradeskills[BLACKSMITHING_ID].queue[0].ticksIntoCraft).toBe(
      3,
    );
  });

  it('completes an item craft: grants the item, logs it, and advances the queue', () => {
    const recipe = buildRecipe({
      craftTime: 5,
      result: { itemId: 'copper-ingot' as ItemId, quantity: 2 },
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({
      'recipe-1': recipe,
      'copper-ingot': { name: 'Copper Ingot' },
    });

    craftProcessTick();

    expect(addMaterial).toHaveBeenCalledWith('copper-ingot', 2);
    expect(craftMessageLog).toHaveBeenCalledWith(
      'Blacksmithing',
      expect.stringContaining('Copper Ingot'),
    );
    expect(analyticsSendDesignEvent).toHaveBeenCalledWith(
      'Kingdom:Craft:Complete:Material Copper Ingot',
    );

    // Call 0: XP grant (rngSucceedsChance mocked true, recipe.tradeskillXP = 1).
    const xpState: GameState = {
      tradeskills: buildAllTradeskills(
        buildBuilding({ level: 1, xp: { current: 0, maximum: 10 } }),
      ),
    } as unknown as GameState;
    expect(
      applyUpdateAt(0, xpState).tradeskills[BLACKSMITHING_ID].xp.current,
    ).toBe(1);

    // Call 1: queue advance - single-unit batch, so the entry is dropped.
    const queueState: GameState = {
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState;
    expect(
      applyUpdateAt(1, queueState).tradeskills[BLACKSMITHING_ID].queue,
    ).toEqual([]);
  });

  it('completes an equipment craft via armoryAdd', () => {
    const recipe = buildRecipe({
      craftTime: 5,
      result: { equipmentId: 'copper-dagger' as EquipmentId },
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({
      'recipe-1': recipe,
      'copper-dagger': { name: 'Copper Dagger' },
    });

    craftProcessTick();

    expect(armoryAdd).toHaveBeenCalledWith('copper-dagger');
    expect(craftMessageLog).toHaveBeenCalledWith(
      'Blacksmithing',
      expect.stringContaining('Copper Dagger'),
    );
  });

  it('completes a collectible craft via collectiblesAdd', () => {
    const recipe = buildRecipe({
      craftTime: 5,
      result: { collectibleId: 'minor-blacksmithing-effigy' as never },
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({
      'recipe-1': recipe,
      'minor-blacksmithing-effigy': { name: 'Minor Blacksmithing Effigy' },
    });

    craftProcessTick();

    expect(collectiblesAdd).toHaveBeenCalledWith(
      'minor-blacksmithing-effigy',
      1,
    );
    expect(craftMessageLog).toHaveBeenCalledWith(
      'Blacksmithing',
      expect.stringContaining('Minor Blacksmithing Effigy'),
    );
  });

  it('logs a failure and produces nothing when an item result chance roll fails', () => {
    const recipe = buildRecipe({
      craftTime: 5,
      result: { itemId: 'malachite' as ItemId, chance: 10 },
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({ 'recipe-1': recipe });
    vi.mocked(rngSucceedsChance).mockReturnValue(false);

    craftProcessTick();

    expect(addMaterial).not.toHaveBeenCalled();
    expect(craftMessageLog).toHaveBeenCalledWith(
      'Blacksmithing',
      expect.stringContaining('failed to craft'),
    );
    // No XP roll succeeded either (same mocked false), so only the
    // queue-advance update fires.
    expect(updateGamestate).toHaveBeenCalledTimes(1);
  });

  it('still grants XP when the item result chance roll fails but the XP roll succeeds', () => {
    const recipe = buildRecipe({
      craftTime: 5,
      tradeskillXP: 5,
      result: { itemId: 'malachite' as ItemId, chance: 10 },
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({ 'recipe-1': recipe });
    // First roll (craft result) fails, second roll (XP) succeeds.
    vi.mocked(rngSucceedsChance)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    craftProcessTick();

    expect(addMaterial).not.toHaveBeenCalled();
    expect(craftMessageLog).toHaveBeenCalledWith(
      'Blacksmithing',
      expect.stringContaining('failed to craft'),
    );
    // The XP-grant update plus the queue-advance update both fire.
    expect(updateGamestate).toHaveBeenCalledTimes(2);
  });

  it('defaults the result quantity to 1 when the recipe omits it', () => {
    const recipe = buildRecipe({
      craftTime: 5,
      result: { itemId: 'malachite' as ItemId, chance: 100 },
    });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState);
    mockGetEntry({ 'recipe-1': recipe, malachite: { name: 'Malachite' } });
    vi.mocked(rngSucceedsChance).mockReturnValue(true);

    craftProcessTick();

    expect(addMaterial).toHaveBeenCalledWith('malachite', 1);
  });

  it('keeps the entry active and resets ticks when more units remain in the batch', () => {
    const recipe = buildRecipe({ craftTime: 5 });
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: buildAllTradeskills(
        buildBuilding({
          queue: [
            buildQueueEntry({
              ticksIntoCraft: 4,
              quantityTotal: 3,
              quantityCompleted: 0,
            }),
          ],
        }),
      ),
    } as unknown as GameState);
    mockGetEntry({
      'recipe-1': recipe,
      'copper-ingot': { name: 'Copper Ingot' },
    });

    craftProcessTick();

    const queueState: GameState = {
      tradeskills: buildAllTradeskills(
        buildBuilding({
          queue: [
            buildQueueEntry({
              ticksIntoCraft: 4,
              quantityTotal: 3,
              quantityCompleted: 0,
            }),
          ],
        }),
      ),
    } as unknown as GameState;
    const result = applyUpdateAt(1, queueState);
    expect(result.tradeskills[BLACKSMITHING_ID].queue).toEqual([
      buildQueueEntry({
        ticksIntoCraft: 0,
        quantityTotal: 3,
        quantityCompleted: 1,
      }),
    ]);
  });
});
