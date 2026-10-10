import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import {
  TRADESKILL_MAX_LEVEL,
  TRADESKILL_QUEUE_BASE_SIZE,
  TRADESKILL_QUEUE_LEVELS_PER_SLOT,
  TRADESKILL_QUEUE_MAX_SIZE,
  TRADESKILL_XP_END,
  TRADESKILL_XP_START,
} from '@helpers/config';
import { ensureCollectible } from '@helpers/content/ensure-item';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import {
  ensureTradeskill,
  ensureTradeskillLevelRequirement,
} from '@helpers/content/ensure-tradeskill';
import {
  craftXpChance,
  craftXpChanceTier,
  migrateTradeskillStateKeys,
  retrofitTradeskillXp,
  tradeskillActiveGate,
  tradeskillBuilding,
  tradeskillBuildingIn,
  tradeskillGainXp,
  tradeskillIdForName,
  tradeskillLevelGateSatisfied,
  tradeskillMaxQueueSize,
  tradeskillNameForId,
  tradeskillXpForLevel,
} from '@helpers/crafting/tradeskill';
import { defaultGameState, defaultTradeskillBuilding } from '@helpers/defaults';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { gamestate, tradeskillsState } from '@helpers/state-game';
import { taskEventTradeskillLevel } from '@helpers/task/task-events';
import type {
  CollectibleId,
  GameState,
  TradeskillBuildingState,
  TradeskillId,
  TradeskillLevelRequirementId,
} from '@interfaces';

const BLACKSMITHING_ID = 'blacksmithing' as TradeskillId;
const WOODWORKING_ID = 'woodworking' as TradeskillId;
const effigyId = 'effigy' as CollectibleId;
const GATED_LEVEL = 5;

const gate = ensureTradeskillLevelRequirement({
  id: 'gate-1' as TradeskillLevelRequirementId,
  name: 'Blacksmithing 5',
  tradeskillId: BLACKSMITHING_ID,
  level: GATED_LEVEL,
  requiredCollectibleId: effigyId,
});

function building(
  overrides: Partial<TradeskillBuildingState> = {},
): TradeskillBuildingState {
  return { ...defaultTradeskillBuilding(), ...overrides };
}

function seedBlacksmithing(
  overrides: Partial<TradeskillBuildingState> = {},
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.tradeskills[BLACKSMITHING_ID] = building(overrides);
    edit?.(state);
  });
}

const ownEffigy = (state: GameState) =>
  applyCollectibleGrant(state, effigyId, 1);

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([
    ensureTradeskill({ id: BLACKSMITHING_ID, name: 'Blacksmithing' }),
    ensureTradeskill({ id: WOODWORKING_ID, name: 'Woodworking' }),
    ensureCollectible({ id: effigyId, name: 'Effigy' }),
    gate,
  ]);
});

describe('tradeskillXpForLevel', () => {
  it('runs from the configured start to the configured end of the curve', () => {
    expect(tradeskillXpForLevel(1)).toBe(TRADESKILL_XP_START);
    expect(tradeskillXpForLevel(TRADESKILL_MAX_LEVEL)).toBe(TRADESKILL_XP_END);
  });

  it('rounds every value to the nearest 10', () => {
    for (let level = 1; level <= TRADESKILL_MAX_LEVEL; level += 1) {
      expect(tradeskillXpForLevel(level) % 10).toBe(0);
    }
  });

  it('eases in: later levels cost more extra xp than early ones', () => {
    const earlyGap = tradeskillXpForLevel(10) - tradeskillXpForLevel(9);
    const lateGap = tradeskillXpForLevel(45) - tradeskillXpForLevel(44);

    expect(lateGap).toBeGreaterThan(earlyGap);
  });
});

describe('retrofitTradeskillXp', () => {
  it("rescales each tradeskill's maximum to the curve, clamping current down without leveling", () => {
    const retrofitted = retrofitTradeskillXp({
      [BLACKSMITHING_ID]: building({
        level: 2,
        xp: { current: 99999, maximum: 99999 },
      }),
      [WOODWORKING_ID]: building({ level: 3, xp: { current: 1, maximum: 7 } }),
    });

    expect(retrofitted[BLACKSMITHING_ID]).toMatchObject({
      level: 2,
      xp: {
        current: tradeskillXpForLevel(2),
        maximum: tradeskillXpForLevel(2),
      },
    });
    expect(retrofitted[WOODWORKING_ID].xp).toEqual({
      current: 1,
      maximum: tradeskillXpForLevel(3),
    });
  });
});

describe('tradeskillMaxQueueSize', () => {
  beforeEach(() => seedGamestate());

  it('starts at the base size and gains a slot every few levels', () => {
    expect(tradeskillMaxQueueSize(1, 'Blacksmithing')).toBe(
      TRADESKILL_QUEUE_BASE_SIZE,
    );
    expect(
      tradeskillMaxQueueSize(
        TRADESKILL_QUEUE_LEVELS_PER_SLOT - 1,
        'Blacksmithing',
      ),
    ).toBe(TRADESKILL_QUEUE_BASE_SIZE);
    expect(
      tradeskillMaxQueueSize(
        TRADESKILL_QUEUE_LEVELS_PER_SLOT * 2,
        'Blacksmithing',
      ),
    ).toBe(TRADESKILL_QUEUE_BASE_SIZE + 2);
  });

  it('never exceeds the max size, even with a boost', () => {
    seedGamestate((state) => {
      state.globalEffectSums.tradeskillQueueSizeBoosts[BLACKSMITHING_ID] = 5;
    });

    expect(tradeskillMaxQueueSize(1000, 'Blacksmithing')).toBe(
      TRADESKILL_QUEUE_MAX_SIZE,
    );
  });

  it("adds only that tradeskill's boost", () => {
    seedGamestate((state) => {
      state.globalEffectSums.tradeskillQueueSizeBoosts[BLACKSMITHING_ID] = 2;
      state.globalEffectSums.tradeskillQueueSizeBoosts[WOODWORKING_ID] = 5;
    });

    expect(tradeskillMaxQueueSize(1, 'Blacksmithing')).toBe(
      TRADESKILL_QUEUE_BASE_SIZE + 2,
    );
  });

  it('treats an unresolvable tradeskill as having no boost', () => {
    seedContent([]);

    expect(tradeskillMaxQueueSize(1, 'Blacksmithing')).toBe(
      TRADESKILL_QUEUE_BASE_SIZE,
    );
  });
});

describe('craftXpChance / craftXpChanceTier', () => {
  const recipe = ensureRecipe({
    minTradeskillLevel: 0,
    maxTradeskillLevel: 20,
  });

  it.each([
    [5, 100, 'Hard'],
    [12, 50, 'Medium'],
    [18, 25, 'Easy'],
    [20, 25, 'Easy'],
    [22, 0, 'Trivial'],
  ])('at level %i is %i%% (%s)', (level, chance, tier) => {
    expect(craftXpChance(recipe, level)).toBe(chance);
    expect(craftXpChanceTier(recipe, level)).toBe(tier);
  });

  it('treats a single-level recipe as Hard at that level and trivial past it', () => {
    const fixed = ensureRecipe({
      minTradeskillLevel: 5,
      maxTradeskillLevel: 5,
    });

    expect(craftXpChanceTier(fixed, 5)).toBe('Hard');
    expect(craftXpChanceTier(fixed, 6)).toBe('Trivial');
  });
});

describe('tradeskill lookups', () => {
  it('resolves ids and names both ways', () => {
    expect(tradeskillIdForName('Blacksmithing')).toBe(BLACKSMITHING_ID);
    expect(tradeskillNameForId(BLACKSMITHING_ID)).toBe('Blacksmithing');
  });

  it('returns undefined rather than throwing before content loads', () => {
    seedContent([]);

    expect(tradeskillIdForName('Blacksmithing')).toBeUndefined();
    expect(tradeskillNameForId(BLACKSMITHING_ID)).toBeUndefined();
  });
});

describe('tradeskillBuilding / tradeskillBuildingIn', () => {
  it('reads the building by name from live state, or by id from a passed state', () => {
    seedBlacksmithing({ level: 12 });
    const state = defaultGameState();
    state.tradeskills[BLACKSMITHING_ID] = building({ level: 7 });

    expect(tradeskillBuilding('Blacksmithing').level).toBe(12);
    expect(tradeskillBuildingIn(state, BLACKSMITHING_ID).level).toBe(7);
  });

  it('falls back to the default building when there is no entry or no content', () => {
    seedGamestate();

    expect(tradeskillBuilding('Woodworking')).toEqual(
      defaultTradeskillBuilding(),
    );
    expect(tradeskillBuildingIn(defaultGameState(), WOODWORKING_ID)).toEqual(
      defaultTradeskillBuilding(),
    );
    seedContent([]);
    expect(tradeskillBuilding('Blacksmithing')).toEqual(
      defaultTradeskillBuilding(),
    );
  });
});

describe('migrateTradeskillStateKeys', () => {
  it('remaps legacy name keys, keeps id keys, and backfills missing tradeskills', () => {
    const legacy = building({ level: 12 });
    const byId = building({ level: 7 });

    const result = migrateTradeskillStateKeys({
      Blacksmithing: legacy,
      [WOODWORKING_ID]: byId,
    });

    expect(result).toEqual({
      [BLACKSMITHING_ID]: legacy,
      [WOODWORKING_ID]: byId,
    });
    expect(migrateTradeskillStateKeys({})).toEqual({
      [BLACKSMITHING_ID]: defaultTradeskillBuilding(),
      [WOODWORKING_ID]: defaultTradeskillBuilding(),
    });
  });
});

describe('tradeskillLevelGateSatisfied / tradeskillActiveGate', () => {
  it("is satisfied at a level with no gate of its own, ignoring other tradeskills' gates", () => {
    seedContent([
      ensureTradeskill({ id: BLACKSMITHING_ID, name: 'Blacksmithing' }),
      ensureTradeskillLevelRequirement({
        ...gate,
        id: 'gate-2' as TradeskillLevelRequirementId,
        tradeskillId: WOODWORKING_ID,
        level: GATED_LEVEL + 1,
      }),
    ]);
    seedGamestate();

    expect(tradeskillLevelGateSatisfied('Blacksmithing', GATED_LEVEL + 1)).toBe(
      true,
    );
  });

  it('reports the active gate only until its collectible is owned', () => {
    seedBlacksmithing({ level: GATED_LEVEL - 1 });
    expect(tradeskillLevelGateSatisfied('Blacksmithing', GATED_LEVEL)).toBe(
      false,
    );
    expect(tradeskillActiveGate('Blacksmithing')).toEqual(gate);

    seedBlacksmithing({ level: GATED_LEVEL - 1 }, ownEffigy);
    expect(tradeskillLevelGateSatisfied('Blacksmithing', GATED_LEVEL)).toBe(
      true,
    );
    expect(tradeskillActiveGate('Blacksmithing')).toBeUndefined();
  });
});

describe('tradeskillGainXp', () => {
  const almostLeveled = () => {
    const maximum = tradeskillXpForLevel(GATED_LEVEL - 1);
    return building({
      level: GATED_LEVEL - 1,
      xp: { current: maximum - 5, maximum },
    });
  };

  it('holds XP at the cap when the next level is gated', () => {
    seedBlacksmithing(almostLeveled());

    inTick(() => tradeskillGainXp('Blacksmithing', 10));

    const result = tradeskillsState()[BLACKSMITHING_ID];
    expect(result.level).toBe(GATED_LEVEL - 1);
    expect(result.xp.current).toBe(result.xp.maximum);
    expect(taskEventTradeskillLevel).not.toHaveBeenCalled();
  });

  it('levels through the gate once its collectible is owned, carrying over leftover xp', () => {
    seedBlacksmithing(almostLeveled(), ownEffigy);
    const events = captureAnalyticsEvents();

    inTick(() => tradeskillGainXp('Blacksmithing', 10));

    expect(tradeskillsState()[BLACKSMITHING_ID]).toMatchObject({
      level: GATED_LEVEL,
      xp: { current: 5, maximum: tradeskillXpForLevel(GATED_LEVEL) },
    });
    expect(events).toContain('Kingdom:Building:LevelUp:Blacksmithing');
    expect(taskEventTradeskillLevel).toHaveBeenCalledWith(
      BLACKSMITHING_ID,
      GATED_LEVEL,
    );
  });

  it('can climb several levels from one large gain', () => {
    seedBlacksmithing({}, ownEffigy);

    inTick(() =>
      tradeskillGainXp(
        'Blacksmithing',
        tradeskillXpForLevel(1) + tradeskillXpForLevel(2),
      ),
    );

    expect(tradeskillsState()[BLACKSMITHING_ID].level).toBe(3);
  });

  it('does nothing for a non-positive amount', () => {
    const before = seedGamestate();
    const events = captureAnalyticsEvents();

    inTick(() => tradeskillGainXp('Blacksmithing', 0));

    expect(gamestate()).toBe(before);
    expect(events).toEqual([]);
  });
});
