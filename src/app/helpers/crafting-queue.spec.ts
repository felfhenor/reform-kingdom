import type * as AnalyticsHelper from '@helpers/analytics';
import type * as MaterialsHelper from '@helpers/materials';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsHelper>();
  return {
    ...actual,
    analyticsSendDesignEvent: vi.fn(),
  };
});

vi.mock('@helpers/armory', () => ({
  armoryAdd: vi.fn(),
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/collectibles', () => ({
  collectiblesAdd: vi.fn(),
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/combat-log', () => ({
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

vi.mock('@helpers/materials', async (importOriginal) => {
  const actual = await importOriginal<typeof MaterialsHelper>();
  return {
    ...actual,
    addMaterial: vi.fn(),
    getMaterialQuantity: vi.fn(() => 0),
  };
});

vi.mock('@helpers/recipes', () => ({
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

import { analyticsSendDesignEvent } from '@helpers/analytics';
import { armoryAdd, armoryGet } from '@helpers/armory';
import {
  collectiblesAdd,
  isCollectibleDiscovered,
} from '@helpers/collectibles';
import { craftMessageLog } from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import {
  craftMaxCraftableQuantity,
  craftProcessTick,
  craftQueueRemove,
  craftQueueStart,
} from '@helpers/crafting-queue';
import { addMaterial, getMaterialQuantity } from '@helpers/materials';
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

function applyUpdateAt(index: number, state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[index][0];
  return updateFn(state);
}

describe('craftMaxCraftableQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(getEntry).mockReturnValue(
      buildRecipe({ tradeskill: 'Woodworking' }),
    );

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 1)).toBe(
      false,
    );
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the building has not reached the recipe level yet', () => {
    vi.mocked(getEntry).mockReturnValue(buildRecipe({ minTradeskillLevel: 5 }));
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { Blacksmithing: buildBuilding({ level: 1 }) },
    } as unknown as GameState);

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 1)).toBe(
      false,
    );
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('fails when the queue is already full', () => {
    vi.mocked(getEntry).mockReturnValue(buildRecipe());
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: {
        Blacksmithing: buildBuilding({
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
    vi.mocked(getEntry).mockReturnValue(
      buildRecipe({ requirements: [{ itemId: 'ore' as ItemId, quantity: 2 }] }),
    );
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { Blacksmithing: buildBuilding({ level: 1 }) },
    } as unknown as GameState);

    expect(craftQueueStart('Blacksmithing', 'recipe-1' as RecipeId, 10)).toBe(
      true,
    );

    const state: GameState = {
      materials: { ore: { quantity: 6, foundAt: 1000 } },
      tradeskills: { Blacksmithing: buildBuilding({ level: 1 }) },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    expect(result.materials['ore' as ItemId]).toBeUndefined();
    expect(result.tradeskills.Blacksmithing.queue).toEqual([
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
    vi.mocked(getEntry).mockReturnValue(buildRecipe({ name: 'Copper Ingot' }));
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { Blacksmithing: buildBuilding({ level: 1 }) },
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
    vi.mocked(getEntry).mockReturnValue(
      buildRecipe({ requirements: [{ itemId: 'ore' as ItemId, quantity: 2 }] }),
    );

    craftQueueRemove('Blacksmithing', 'queue-entry-1' as CraftQueueEntryId);

    const state: GameState = {
      materials: {},
      tradeskills: {
        Blacksmithing: buildBuilding({
          queue: [buildQueueEntry({ quantityTotal: 5, quantityCompleted: 2 })],
        }),
      },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    // 3 units unconsumed * 2 ore per unit = 6 refunded.
    expect(result.materials['ore' as ItemId].quantity).toBe(6);
    expect(result.tradeskills.Blacksmithing.queue).toEqual([]);
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
    vi.mocked(getEntry).mockReturnValue(buildRecipe({ craftTime: 5 }));

    craftProcessTick();

    expect(addMaterial).not.toHaveBeenCalled();
    expect(updateGamestate).toHaveBeenCalledTimes(1);

    const state: GameState = {
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 2 })] }),
      ),
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);
    expect(result.tradeskills.Blacksmithing.queue[0].ticksIntoCraft).toBe(3);
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
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'recipe-1') return recipe as never;
      if (id === 'copper-ingot') return { name: 'Copper Ingot' } as never;
      return undefined;
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
    expect(applyUpdateAt(0, xpState).tradeskills.Blacksmithing.xp.current).toBe(
      1,
    );

    // Call 1: queue advance - single-unit batch, so the entry is dropped.
    const queueState: GameState = {
      tradeskills: buildAllTradeskills(
        buildBuilding({ queue: [buildQueueEntry({ ticksIntoCraft: 4 })] }),
      ),
    } as unknown as GameState;
    expect(
      applyUpdateAt(1, queueState).tradeskills.Blacksmithing.queue,
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
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'recipe-1') return recipe as never;
      if (id === 'copper-dagger') return { name: 'Copper Dagger' } as never;
      return undefined;
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
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'recipe-1') return recipe as never;
      if (id === 'minor-blacksmithing-effigy') {
        return { name: 'Minor Blacksmithing Effigy' } as never;
      }
      return undefined;
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
    vi.mocked(getEntry).mockReturnValue(recipe);
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
    vi.mocked(getEntry).mockReturnValue(recipe);
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
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'recipe-1') return recipe as never;
      return { name: 'Malachite' } as never;
    });
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
    vi.mocked(getEntry).mockImplementation((id: string) => {
      if (id === 'recipe-1') return recipe as never;
      return { name: 'Copper Ingot' } as never;
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
    expect(result.tradeskills.Blacksmithing.queue).toEqual([
      buildQueueEntry({
        ticksIntoCraft: 0,
        quantityTotal: 3,
        quantityCompleted: 1,
      }),
    ]);
  });
});
