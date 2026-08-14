import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(() => []),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntriesByType } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  craftXpChance,
  craftXpChanceTier,
  retrofitTradeskillXp,
  tradeskillActiveGate,
  tradeskillGainXp,
  tradeskillLevelGateSatisfied,
  tradeskillMaxQueueSize,
  tradeskillXpForLevel,
} from '@helpers/tradeskill';
import type {
  GameState,
  GameStateTradeskills,
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
    result: { itemId: 'copper-ingot' as never, quantity: 1 },
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
