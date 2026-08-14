import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntriesByType } from '@helpers/content';
import { roundToNearest10 } from '@helpers/number';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  ChanceTier,
  GameStateTradeskills,
  RecipeContent,
  Tradeskill,
  TradeskillBuildingState,
  TradeskillLevelRequirementContent,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';

export const TRADESKILL_MAX_LEVEL = 50;
const TRADESKILL_XP_START = 10;
const TRADESKILL_XP_END = 5000;
const XP_CURVE_EASE = 1.5;

// Tunable XP curve: eases in from 10 XP at level 1 up to 5,000 XP at the
// level cap, rounded to the nearest 10 for clean numbers. The
// `progress ** 1.5` ease keeps the early-level jumps gentle instead of a
// straight line's constant per-level step dominating a tiny starting value.
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
  return gamestate().tradeskills[tradeskill];
}

function levelRequirementFor(
  tradeskill: Tradeskill,
  level: number,
): TradeskillLevelRequirementContent | undefined {
  return getEntriesByType<TradeskillLevelRequirementContent>(
    'tradeskilllevelrequirement',
  ).find((entry) => entry.tradeskill === tradeskill && entry.level === level);
}

export function tradeskillLevelGateSatisfied(
  tradeskill: Tradeskill,
  level: number,
): boolean {
  const requirement = levelRequirementFor(tradeskill, level);
  if (!requirement) return true;

  return isCollectibleDiscovered(requirement.requiredCollectibleId);
}

// The requirement blocking the *next* level, only while it's still
// unsatisfied - once the collectible is found this returns undefined and the
// building levels up on its next XP grant (see `tradeskillLeveledUp`).
export function tradeskillActiveGate(
  tradeskill: Tradeskill,
): TradeskillLevelRequirementContent | undefined {
  const nextLevel = tradeskillBuilding(tradeskill).level + 1;
  if (tradeskillLevelGateSatisfied(tradeskill, nextLevel)) return undefined;

  return levelRequirementFor(tradeskill, nextLevel);
}

// Mirrors `characterLeveledUp` in `party.ts`, but each level also requires
// `tradeskillLevelGateSatisfied` - if XP is enough but the gate isn't met,
// XP holds at the cap (no loss) rather than levelling, and releases the next
// time XP is granted after the collectible is found.
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

// Rescales every tradeskill's xp.maximum to match the current
// `tradeskillXpForLevel` curve, clamping `current` down if it now exceeds
// the new maximum. Never forces a level-up itself - a building sitting
// exactly at its new maximum simply levels up on its next real XP grant
// (see `tradeskillLeveledUp`).
export function retrofitTradeskillXp(
  tradeskills: GameStateTradeskills,
): GameStateTradeskills {
  const retrofitted = { ...tradeskills };

  ALL_TRADESKILLS.forEach((tradeskill) => {
    const building = retrofitted[tradeskill];
    const maximum = tradeskillXpForLevel(building.level);

    retrofitted[tradeskill] = {
      ...building,
      xp: { current: Math.min(building.xp.current, maximum), maximum },
    };
  });

  return retrofitted;
}

export function tradeskillGainXp(tradeskill: Tradeskill, amount: number): void {
  if (amount <= 0) return;

  updateGamestate((state) => {
    state.tradeskills[tradeskill] = tradeskillLeveledUp(
      state.tradeskills[tradeskill],
      tradeskill,
      amount,
    );
    return state;
  });
}

// WoW-style skill-up odds: fresh (< 50% through the recipe's level range) is
// guaranteed, the back half is a coin flip, the last quarter is a long shot,
// and a building that has out-levelled the recipe entirely gets nothing. A
// recipe with a single-level range (min === max) is always exactly "fresh"
// the moment it's visible, so it's always guaranteed too.
export function craftXpChance(
  recipe: RecipeContent,
  buildingLevel: number,
): number {
  const { minTradeskillLevel: min, maxTradeskillLevel: max } = recipe;
  if (max <= min) return 100;

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
