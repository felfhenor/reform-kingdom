import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(() => []),
  getEntry: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  craftXpChance,
  craftXpChanceTier,
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
  tradeskillActiveGate,
  tradeskillBuilding,
  tradeskillGainXp,
  tradeskillIdForName,
  tradeskillLevelGateSatisfied,
  tradeskillMaxQueueSize,
  tradeskillNameForId,
  tradeskillXpForLevel,
} from '@helpers/tradeskill';
import type {
  GameState,
  GameStateTradeskills,
  RecipeContent,
  RecipeId,
  TradeskillBuildingState,
  TradeskillContent,
  TradeskillId,
  TradeskillLevelRequirementContent,
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

// Resolves `getEntry` the same way the real content map would - by id or by
// the matching `Tradeskill` name - so `tradeskillIdForName`/`tradeskillNameForId`
// behave consistently with the fixtures below.
function mockTradeskillContentLookup(...content: TradeskillContent[]): void {
  vi.mocked(getEntry).mockImplementation((key: string) => {
    const match = content.find((c) => c.id === key || c.name === key);
    return match as never;
  });
}

function buildRecipe(overrides: Partial<RecipeContent> = {}): RecipeContent {
  return {
    id: 'recipe-1' as RecipeId,
    name: 'Material: Copper Ingot',
    __type: 'recipe',
    result: { itemId: 'copper-ingot' as never, quantity: 1 },
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

    expect(retrofitted[BLACKSMITHING_ID].xp).toEqual({
      current: 5,
      maximum: tradeskillXpForLevel(2),
    });
  });

  it('clamps current xp down without leveling up when it now exceeds the new maximum', () => {
    const tradeskills = buildAllTradeskills(
      buildBuilding({ level: 2, xp: { current: 99999, maximum: 99999 } }),
    );

    const retrofitted = retrofitTradeskillXp(tradeskills);

    expect(retrofitted[BLACKSMITHING_ID].level).toBe(2);
    expect(retrofitted[BLACKSMITHING_ID].xp).toEqual({
      current: tradeskillXpForLevel(2),
      maximum: tradeskillXpForLevel(2),
    });
  });

  it('rescales every tradeskill independently', () => {
    const tradeskills: GameStateTradeskills = {
      [ARTIFICING_ID]: buildBuilding({
        level: 3,
        xp: { current: 1, maximum: 20 },
      }),
      [BLACKSMITHING_ID]: buildBuilding({ level: 1 }),
      [JEWELCRAFTING_ID]: buildBuilding({ level: 1 }),
      [TAILORING_ID]: buildBuilding({ level: 1 }),
      [WOODWORKING_ID]: buildBuilding({ level: 1 }),
    };

    const retrofitted = retrofitTradeskillXp(tradeskills);

    expect(retrofitted[ARTIFICING_ID].xp.maximum).toBe(tradeskillXpForLevel(3));
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

describe('tradeskillIdForName / tradeskillNameForId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves an id from a name when content is loaded', () => {
    mockTradeskillContentLookup(blacksmithingContent);
    expect(tradeskillIdForName('Blacksmithing')).toBe(BLACKSMITHING_ID);
  });

  it('resolves a name from an id when content is loaded', () => {
    mockTradeskillContentLookup(blacksmithingContent);
    expect(tradeskillNameForId(BLACKSMITHING_ID)).toBe('Blacksmithing');
  });

  it('returns undefined rather than throwing when content is not loaded', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    expect(tradeskillIdForName('Blacksmithing')).toBeUndefined();
    expect(tradeskillNameForId(BLACKSMITHING_ID)).toBeUndefined();
  });
});

describe('tradeskillBuilding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the state entry keyed by the resolved id', () => {
    mockTradeskillContentLookup(blacksmithingContent);
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: { [BLACKSMITHING_ID]: buildBuilding({ level: 12 }) },
    } as unknown as GameState);

    expect(tradeskillBuilding('Blacksmithing').level).toBe(12);
  });

  it('falls back to a safe default when content is not loaded yet, rather than throwing', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    vi.mocked(gamestate).mockReturnValue({ tradeskills: {} } as unknown as GameState);

    expect(tradeskillBuilding('Blacksmithing')).toEqual({
      level: 1,
      xp: { current: 0, maximum: 10 },
      queue: [],
    });
  });
});

describe('migrateTradeskillStateKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('remaps legacy name-keyed entries to id-keyed entries', () => {
    vi.mocked(getEntriesByType).mockReturnValue([blacksmithingContent]);
    mockTradeskillContentLookup(blacksmithingContent);

    const legacyBuilding = buildBuilding({ level: 12 });
    const result = migrateTradeskillStateKeys({ Blacksmithing: legacyBuilding });

    expect(result[BLACKSMITHING_ID]).toEqual(legacyBuilding);
  });

  it('passes an already-id-keyed entry through unchanged', () => {
    vi.mocked(getEntriesByType).mockReturnValue([blacksmithingContent]);
    mockTradeskillContentLookup(blacksmithingContent);

    const building = buildBuilding({ level: 7 });
    const result = migrateTradeskillStateKeys({ [BLACKSMITHING_ID]: building });

    expect(result[BLACKSMITHING_ID]).toEqual(building);
  });

  it('backfills a default entry for a tradeskill missing from the input entirely', () => {
    vi.mocked(getEntriesByType).mockReturnValue([blacksmithingContent]);
    mockTradeskillContentLookup(blacksmithingContent);

    const result = migrateTradeskillStateKeys({});

    expect(result[BLACKSMITHING_ID]).toEqual({
      level: 1,
      xp: { current: 0, maximum: 10 },
      queue: [],
    });
  });
});

describe('tradeskillLevelGateSatisfied / tradeskillActiveGate', () => {
  const gate: TradeskillLevelRequirementContent = {
    id: 'gate-1' as never,
    name: 'Tradeskill Level Requirement: Blacksmithing 10',
    __type: 'tradeskilllevelrequirement',
    tradeskillId: BLACKSMITHING_ID,
    level: 10,
    requiredCollectibleId: 'minor-blacksmithing-effigy' as never,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTradeskillContentLookup(blacksmithingContent);
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
      tradeskills: { [BLACKSMITHING_ID]: buildBuilding({ level: 9 }) },
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
    tradeskillId: BLACKSMITHING_ID,
    level: 5,
    requiredCollectibleId: 'minor-blacksmithing-effigy' as never,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTradeskillContentLookup(blacksmithingContent);
    vi.mocked(getEntriesByType).mockReturnValue([gate]);
  });

  it('holds XP at the cap when the next level is gated', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: {
        [BLACKSMITHING_ID]: buildBuilding({
          level: 4,
          xp: { current: 5, maximum: 10 },
        }),
      },
    } as unknown as GameState);

    tradeskillGainXp('Blacksmithing', 10);

    const state: GameState = {
      tradeskills: {
        [BLACKSMITHING_ID]: buildBuilding({
          level: 4,
          xp: { current: 5, maximum: 10 },
        }),
      },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    expect(result.tradeskills[BLACKSMITHING_ID]).toEqual({
      level: 4,
      xp: { current: 10, maximum: 10 },
      queue: [],
    });
  });

  it('releases through the gate once the collectible is found', () => {
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    vi.mocked(gamestate).mockReturnValue({
      tradeskills: {
        [BLACKSMITHING_ID]: buildBuilding({
          level: 4,
          xp: { current: 5, maximum: 10 },
        }),
      },
    } as unknown as GameState);

    tradeskillGainXp('Blacksmithing', 10);

    const state: GameState = {
      tradeskills: {
        [BLACKSMITHING_ID]: buildBuilding({
          level: 4,
          xp: { current: 5, maximum: 10 },
        }),
      },
    } as unknown as GameState;
    const result = applyUpdateAt(0, state);

    expect(result.tradeskills[BLACKSMITHING_ID].level).toBe(5);
    expect(result.tradeskills[BLACKSMITHING_ID].xp.current).toBe(5);
    expect(result.tradeskills[BLACKSMITHING_ID].xp.maximum).toBe(
      tradeskillXpForLevel(5),
    );
  });

  it('does nothing for a non-positive amount', () => {
    tradeskillGainXp('Blacksmithing', 0);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});
