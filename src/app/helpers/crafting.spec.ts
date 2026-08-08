import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/materials', () => ({
  addMaterial: vi.fn(),
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/recipes', () => ({
  isRecipeCraftable: vi.fn(() => true),
  recipeBackdropSprite: vi.fn(() => '0099'),
  recipeResultContent: vi.fn(),
  recipeResultSpritesheet: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngSucceedsChance: vi.fn(() => true),
  rngUuid: vi.fn(() => 'queue-entry-1'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { armoryAdd, armoryGet } from '@helpers/armory';
import {
  collectiblesAdd,
  isCollectibleDiscovered,
} from '@helpers/collectibles';
import { craftMessageLog } from '@helpers/combat-log';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  craftMaxCraftableQuantity,
  craftProcessTick,
  craftQueueRemove,
  craftQueueStart,
  craftQueueTicksRemaining,
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
  craftXpChance,
  craftXpChanceTier,
  getCraftableRecipeEntries,
  pruneInvalidCraftQueues,
  retrofitTradeskillXp,
  tradeskillActiveGate,
  tradeskillGainXp,
  tradeskillLevelGateSatisfied,
  tradeskillMaxQueueSize,
  tradeskillXpForLevel,
} from '@helpers/crafting';
import { addMaterial, getMaterialQuantity } from '@helpers/materials';
import {
  isRecipeCraftable,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/recipes';
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
  TradeskillLevelRequirementContent,
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

describe('tradeskillXpForLevel', () => {
  it('requires 10 xp to reach level 2 from level 1', () => {
    expect(tradeskillXpForLevel(1)).toBe(10);
  });

  it('eases in gradually rather than jumping hard on the early levels', () => {
    expect(tradeskillXpForLevel(2)).toBe(20);
    expect(tradeskillXpForLevel(3)).toBeGreaterThan(tradeskillXpForLevel(2));
  });

  it('reaches 5000 xp at the level cap', () => {
    expect(tradeskillXpForLevel(50)).toBe(5000);
  });

  it('rounds every value to the nearest 10', () => {
    for (let level = 1; level <= 50; level += 1) {
      expect(tradeskillXpForLevel(level) % 10).toBe(0);
    }
  });

  it('grows by a larger amount per level as level increases (ease-in curve)', () => {
    const earlyGap = tradeskillXpForLevel(10) - tradeskillXpForLevel(9);
    const lateGap = tradeskillXpForLevel(45) - tradeskillXpForLevel(44);
    expect(lateGap).toBeGreaterThan(earlyGap);
  });
});

describe('retrofitTradeskillXp', () => {
  it("rescales a tradeskill's xp.maximum to the current curve for its level", () => {
    const tradeskills = buildAllTradeskills(
      buildBuilding({ level: 2, xp: { current: 5, maximum: 15 } }),
    );

    const retrofitted = retrofitTradeskillXp(tradeskills);

    expect(retrofitted.Blacksmithing.xp).toEqual({
      current: 5,
      maximum: tradeskillXpForLevel(2),
    });
  });

  it('clamps current xp down without leveling up when it now exceeds the new maximum', () => {
    const tradeskills = buildAllTradeskills(
      buildBuilding({ level: 2, xp: { current: 99999, maximum: 99999 } }),
    );

    const retrofitted = retrofitTradeskillXp(tradeskills);

    expect(retrofitted.Blacksmithing.level).toBe(2);
    expect(retrofitted.Blacksmithing.xp).toEqual({
      current: tradeskillXpForLevel(2),
      maximum: tradeskillXpForLevel(2),
    });
  });

  it('rescales every tradeskill independently', () => {
    const tradeskills: GameStateTradeskills = {
      Artificing: buildBuilding({ level: 3, xp: { current: 1, maximum: 20 } }),
      Blacksmithing: buildBuilding({ level: 1 }),
      Jewelcrafting: buildBuilding({ level: 1 }),
      Tailoring: buildBuilding({ level: 1 }),
      Woodworking: buildBuilding({ level: 1 }),
    };

    const retrofitted = retrofitTradeskillXp(tradeskills);

    expect(retrofitted.Artificing.xp.maximum).toBe(tradeskillXpForLevel(3));
  });
});

describe('tradeskillMaxQueueSize', () => {
  it('defaults to 2 below level 5', () => {
    expect(tradeskillMaxQueueSize(1)).toBe(2);
    expect(tradeskillMaxQueueSize(4)).toBe(2);
  });

  it('gains 1 slot every 5 levels', () => {
    expect(tradeskillMaxQueueSize(5)).toBe(3);
    expect(tradeskillMaxQueueSize(10)).toBe(4);
    expect(tradeskillMaxQueueSize(20)).toBe(6);
  });

  it('caps at 10', () => {
    expect(tradeskillMaxQueueSize(40)).toBe(10);
    expect(tradeskillMaxQueueSize(50)).toBe(10);
  });
});

describe('craftXpChance / craftXpChanceTier', () => {
  const recipe = buildRecipe({ minTradeskillLevel: 0, maxTradeskillLevel: 20 });

  it('is guaranteed in the first half of the recipe range', () => {
    expect(craftXpChance(recipe, 5)).toBe(100);
    expect(craftXpChanceTier(recipe, 5)).toBe('Guaranteed');
  });

  it('is a coin flip from 50% through 75% of the range', () => {
    expect(craftXpChance(recipe, 12)).toBe(50);
    expect(craftXpChanceTier(recipe, 12)).toBe('Likely');
  });

  it('is a long shot in the last 25% of the range', () => {
    expect(craftXpChance(recipe, 18)).toBe(25);
    expect(craftXpChanceTier(recipe, 18)).toBe('Possible');
  });

  it('is zero once the building has out-levelled the recipe', () => {
    expect(craftXpChance(recipe, 20)).toBe(0);
    expect(craftXpChanceTier(recipe, 20)).toBe('Trivial');
  });

  it('treats a degenerate (min === max) range as always "Guaranteed" - it is exactly "fresh" the moment it is visible', () => {
    const fixedRecipe = buildRecipe({
      minTradeskillLevel: 5,
      maxTradeskillLevel: 5,
    });
    expect(craftXpChance(fixedRecipe, 5)).toBe(100);
    expect(craftXpChanceTier(fixedRecipe, 5)).toBe('Guaranteed');
  });
});

describe('tradeskillLevelGateSatisfied / tradeskillActiveGate', () => {
  const gate: TradeskillLevelRequirementContent = {
    id: 'gate-1' as never,
    name: 'Tradeskill Level Requirement: Blacksmithing 10',
    __type: 'tradeskilllevelrequirement',
    tradeskill: 'Blacksmithing',
    level: 10,
    requiredCollectibleId: 'minor-blacksmithing-effigy' as never,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is satisfied when there is no gate at that level', () => {
    vi.mocked(getEntriesByType).mockReturnValue([]);
    expect(tradeskillLevelGateSatisfied('Blacksmithing', 10)).toBe(true);
  });

  it('defers to collectible discovery when a gate exists', () => {
    vi.mocked(getEntriesByType).mockReturnValue([gate]);
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
    expect(tradeskillLevelGateSatisfied('Blacksmithing', 10)).toBe(false);

    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    expect(tradeskillLevelGateSatisfied('Blacksmithing', 10)).toBe(true);
  });

  it('reports the active gate only while unsatisfied', () => {
    vi.mocked(getEntriesByType).mockReturnValue([gate]);
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { Blacksmithing: buildBuilding({ level: 9 }) },
    } as unknown as GameState);

    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
    expect(tradeskillActiveGate('Blacksmithing')).toBe(gate);

    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    expect(tradeskillActiveGate('Blacksmithing')).toBeUndefined();
  });
});

describe('tradeskillGainXp', () => {
  const gate: TradeskillLevelRequirementContent = {
    id: 'gate-1' as never,
    name: 'Tradeskill Level Requirement: Blacksmithing 5',
    __type: 'tradeskilllevelrequirement',
    tradeskill: 'Blacksmithing',
    level: 5,
    requiredCollectibleId: 'minor-blacksmithing-effigy' as never,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntriesByType).mockReturnValue([gate]);
  });

  it('holds XP at the cap when the next level is gated', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);

    tradeskillGainXp('Blacksmithing', 10);

    const state: GameState = {
      tradeskills: {
        Blacksmithing: buildBuilding({
          level: 4,
          xp: { current: 5, maximum: 10 },
        }),
      },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    expect(result.tradeskills.Blacksmithing).toEqual({
      level: 4,
      xp: { current: 10, maximum: 10 },
      queue: [],
    });
  });

  it('releases through the gate once the collectible is found', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);

    tradeskillGainXp('Blacksmithing', 10);

    const state: GameState = {
      tradeskills: {
        Blacksmithing: buildBuilding({
          level: 4,
          xp: { current: 5, maximum: 10 },
        }),
      },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    expect(result.tradeskills.Blacksmithing.level).toBe(5);
    expect(result.tradeskills.Blacksmithing.xp.current).toBe(5);
    expect(result.tradeskills.Blacksmithing.xp.maximum).toBe(
      tradeskillXpForLevel(5),
    );
  });

  it('does nothing for a non-positive amount', () => {
    tradeskillGainXp('Blacksmithing', 0);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

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
    vi.mocked(getEntriesByType).mockReturnValue([]);
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
      'Blacksmithing',
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
    vi.mocked(getMaterialQuantity).mockReturnValue(0);
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

  it('orders requirement entries collectible, then equipment, then item', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(10);
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
