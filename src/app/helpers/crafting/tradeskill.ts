import { getEntriesByType, getEntry } from '@helpers/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { roundToNearest10 } from '@helpers/engine/number';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  ChanceTier,
  GameState,
  GameStateTradeskills,
  RecipeContent,
  Tradeskill,
  TradeskillBuildingState,
  TradeskillContent,
  TradeskillId,
  TradeskillLevelRequirementContent,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';

export const TRADESKILL_MAX_LEVEL = 50;
const TRADESKILL_XP_START = 10;
const TRADESKILL_XP_END = 5000;
const XP_CURVE_EASE = 1.5;

// `xp.maximum: 10` matches `tradeskillXpForLevel(1)`, kept as a literal here to avoid an import cycle.
const DEFAULT_BUILDING: TradeskillBuildingState = {
  level: 1,
  xp: { current: 0, maximum: 10 },
  queue: [],
};

// Never throws - content may not be loaded yet on early renders (e.g. a
// returning player whose persisted `kingdomSubview` reopens a tradeskill
// screen before `ContentService` finishes its async load). Callers must
// tolerate `undefined` gracefully; `getEntry` is reactive, so once content
// loads any `computed()` that read this resolves correctly on its own.
export function tradeskillIdForName(
  tradeskill: Tradeskill,
): TradeskillId | undefined {
  return getEntry<TradeskillContent>(tradeskill)?.id;
}

export function tradeskillNameForId(id: TradeskillId): Tradeskill | undefined {
  return getEntry<TradeskillContent>(id)?.name as Tradeskill | undefined;
}

// Eases from 10 XP at level 1 to 5,000 at the cap; progress**1.5 keeps early-level jumps gentle.
export function tradeskillXpForLevel(level: number): number {
  const progress = (level - 1) / (TRADESKILL_MAX_LEVEL - 1);
  const xp =
    TRADESKILL_XP_START +
    (TRADESKILL_XP_END - TRADESKILL_XP_START) * progress ** XP_CURVE_EASE;
  return roundToNearest10(xp);
}

// Default 2 (1 active + 1 queued), +1 every 5 levels, capped at 10.
export function tradeskillMaxQueueSize(level: number): number {
  return Math.min(10, 2 + Math.floor(level / 5));
}

export function tradeskillBuilding(
  tradeskill: Tradeskill,
): TradeskillBuildingState {
  const id = tradeskillIdForName(tradeskill);
  if (!id) return DEFAULT_BUILDING;
  return gamestate().tradeskills[id] ?? DEFAULT_BUILDING;
}

// Same fallback as `tradeskillBuilding`, for `updateGamestate` callbacks -
// they must read the draft `state` they were handed, not `gamestate()`.
export function tradeskillBuildingIn(
  state: GameState,
  tradeskillId: TradeskillId,
): TradeskillBuildingState {
  return state.tradeskills[tradeskillId] ?? DEFAULT_BUILDING;
}

function levelRequirementFor(
  tradeskill: Tradeskill,
  level: number,
): TradeskillLevelRequirementContent | undefined {
  const tradeskillId = tradeskillIdForName(tradeskill);
  return getEntriesByType<TradeskillLevelRequirementContent>(
    'tradeskilllevelrequirement',
  ).find(
    (entry) => entry.tradeskillId === tradeskillId && entry.level === level,
  );
}

export function tradeskillLevelGateSatisfied(
  tradeskill: Tradeskill,
  level: number,
): boolean {
  const requirement = levelRequirementFor(tradeskill, level);
  if (!requirement) return true;

  return isCollectibleDiscovered(requirement.requiredCollectibleId);
}

// The requirement blocking the next level, or undefined once satisfied (see tradeskillLeveledUp).
export function tradeskillActiveGate(
  tradeskill: Tradeskill,
): TradeskillLevelRequirementContent | undefined {
  const nextLevel = tradeskillBuilding(tradeskill).level + 1;
  if (tradeskillLevelGateSatisfied(tradeskill, nextLevel)) return undefined;

  return levelRequirementFor(tradeskill, nextLevel);
}

// Like characterLeveledUp, but gated by tradeskillLevelGateSatisfied - XP holds at the cap (no loss) until the gate clears.
function tradeskillLeveledUp(
  building: TradeskillBuildingState,
  tradeskill: Tradeskill,
  amount: number,
): TradeskillBuildingState {
  let level = building.level;
  let current = building.xp.current + amount;
  let maximum = building.xp.maximum;

  while (
    level < TRADESKILL_MAX_LEVEL &&
    current >= maximum &&
    tradeskillLevelGateSatisfied(tradeskill, level + 1)
  ) {
    current -= maximum;
    level += 1;
    maximum = tradeskillXpForLevel(level);
  }

  if (current > maximum) current = maximum;

  return { ...building, level, xp: { current, maximum } };
}

// Rescales xp.maximum to the current curve, clamping current down if needed. Never forces a level-up itself.
export function retrofitTradeskillXp(
  tradeskills: GameStateTradeskills,
): GameStateTradeskills {
  const retrofitted = { ...tradeskills };

  (Object.keys(retrofitted) as TradeskillId[]).forEach((tradeskillId) => {
    const building = retrofitted[tradeskillId];
    const maximum = tradeskillXpForLevel(building.level);

    retrofitted[tradeskillId] = {
      ...building,
      xp: { current: Math.min(building.xp.current, maximum), maximum },
    };
  });

  return retrofitted;
}

export function tradeskillGainXp(tradeskill: Tradeskill, amount: number): void {
  if (amount <= 0) return;

  const tradeskillId = tradeskillIdForName(tradeskill);
  if (!tradeskillId) return;

  const previousLevel = tradeskillBuilding(tradeskill).level;
  let newLevel = previousLevel;

  updateGamestate((state) => {
    state.tradeskills[tradeskillId] = tradeskillLeveledUp(
      tradeskillBuildingIn(state, tradeskillId),
      tradeskill,
      amount,
    );
    newLevel = state.tradeskills[tradeskillId].level;
    return state;
  });

  if (newLevel > previousLevel) {
    analyticsSendDesignEvent(
      `Kingdom:Building:LevelUp:${analyticsSafeSegment(tradeskill)}`,
      newLevel,
    );
  }
}

// Remaps a save's tradeskill keys from the pre-gamedata `Tradeskill` name
// strings (e.g. "Blacksmithing") to real TradeskillId values, then backfills
// any tradeskill known to gamedata that still has no entry (covers a
// brand-new save, whose `defaultTradeskills()` is deliberately empty - see
// `defaults.ts`). A legacy key already shaped like an id passes through
// unchanged, and an unresolvable legacy key (should never happen once
// content is loaded) is defensively dropped rather than aborting the whole
// migration. This function is only ever called once content is guaranteed
// loaded (see `migrateGameState`), unlike `tradeskillIdForName` elsewhere.
export function migrateTradeskillStateKeys(
  tradeskills: Record<string, TradeskillBuildingState>,
): GameStateTradeskills {
  const remapped = {} as GameStateTradeskills;

  Object.entries(tradeskills ?? {}).forEach(([key, building]) => {
    const isLegacyName = (ALL_TRADESKILLS as string[]).includes(key);
    const id = isLegacyName
      ? tradeskillIdForName(key as Tradeskill)
      : (key as TradeskillId);
    if (id) remapped[id] = building;
  });

  getEntriesByType<TradeskillContent>('tradeskill').forEach((content) => {
    remapped[content.id] ??= DEFAULT_BUILDING;
  });

  return remapped;
}

// WoW-style skill-up odds: guaranteed early, coin flip past halfway, long shot near the cap, nothing once out-levelled.
export function craftXpChance(
  recipe: RecipeContent,
  buildingLevel: number,
): number {
  const { minTradeskillLevel: min, maxTradeskillLevel: max } = recipe;
  if (max <= min) return buildingLevel <= min ? 100 : 0;

  const progress = (buildingLevel - min) / (max - min);
  if (progress >= 1) return 0;
  if (progress >= 0.75) return 25;
  if (progress >= 0.5) return 50;
  return 100;
}

export function craftXpChanceTier(
  recipe: RecipeContent,
  buildingLevel: number,
): ChanceTier {
  const chance = craftXpChance(recipe, buildingLevel);

  if (chance >= 100) return 'Guaranteed';
  if (chance >= 50) return 'Likely';
  if (chance >= 25) return 'Possible';
  return 'Trivial';
}
