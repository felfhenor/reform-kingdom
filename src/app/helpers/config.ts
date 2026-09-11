// Every tunable scalar/numeric game-balance constant lives here, grouped by the domain that consumes it.
// This is NOT the place for: signals/state, debug-tool
// definitions, icon/UI maps, string identifiers that reference content by name/type, or fixed constants
// dictated by an external format/protocol (e.g. the Tiled map format's GID bitmask flags, IndexedDB
// connection details) rather than authored game balance

import type { BaseStat, CombatStat, StatusEffectTag } from '@interfaces';

// Caravan

export const ACTIVE_TRADE_COUNT = 4;
export const URGENCY_SAFE_MIN_TICKS = 1800; // 30 minutes
export const URGENCY_WARNING_MIN_TICKS = 300; // 5 minutes

// Combat

export const COMBAT_ORDER_ROW_CAP = 10;

// XP degrades once the party out-levels a node's max, bottoming out at a flat 1 XP - keeps overleveled parties from farming trivial nodes.
export const OVERLEVEL_XP_DEGRADE_PER_LEVEL = 0.25;
export const OVERLEVEL_XP_HARD_CAP_LEVELS = 4;
export const OVERLEVEL_XP_HARD_CAP_AMOUNT = 1;

// Commission

// Fixed UTC-6 offset year-round (no DST handling, by design) - "3AM CST" as a wall-clock reset boundary.
// See CaravanContent.traderResetTime. See CommissionNodeState.generatedAt.
export const COMMISSION_RESET_HOUR_UTC = 9;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Crafting

export const MAX_CRAFTABLE_CAP = 99;
export const TRADESKILL_MAX_LEVEL = 50;
export const TRADESKILL_XP_START = 10;
export const TRADESKILL_XP_END = 5000;

// Decree

// Losing streak at which mostChallengingExploreNodeForRisk gives up on a tier and steps down.
export const LEVEL_UP_NODE_FAILURE_LIMIT = 5;

// Engine

export const MAX_EVENT_SEGMENTS = 5;
export const MAX_SEGMENT_LENGTH = 32;

// Beyond this many levels above the party's floor, a range is excluded outright (TooHigh) regardless of risk setting.
export const HIGH_RISK_LEVELS_ABOVE_PARTY = 7;

// Caps how many ticks run before yielding to the browser during a long catch-up (e.g. after the tab was backgrounded), so it doesn't block the main thread for seconds at a time.
export const TICKS_PER_YIELD = 100;

// A "practically forever" duration for a global effect that's removed explicitly (on a state change or leaving a map), not by natural expiry - long enough it never lapses on its own during normal play. Used by the Idle and Auto Mode effects.
export const ONE_YEAR_TICKS = 60 * 60 * 24 * 365;

// Hero

export const HEALING_MINIMUM_SECONDS = 10;
export const HEALING_SECONDS_PER_LEVEL = 2;
export const RECLASS_GOLD_PER_LEVEL = 100;
export const CHARACTER_MAX_LEVEL = 99;
export const CHARACTER_XP_START = 100;
export const CHARACTER_XP_END = 100000;
export const RESTING_REGEN_PERCENT = 0.01;
export const TICKS_PER_STEP_ON_PATH = 1;
export const TICKS_PER_STEP_OFF_PATH = 3;
export const DEATHS_DOOR_SECONDS_PER_MAP = 10;
export const DEATHS_DOOR_MINIMUM_SECONDS = 10;

// Shared exponent for the house XP-curve shape (start + (end - start) * progress^EASE) used by character,
// tradeskill, and worker leveling - see patterns.md's "shared XP-curve shape" note.
export const XP_CURVE_EASE = 1.5;

// Item

export const GOLD_PER_STAT_POINT = 30;
export const GOLD_PER_RESISTANCE_POINT = 100;
export const GOLD_PER_COMBAT_STAT_POINT = 50;
export const STARTING_GOLD_AMOUNT = 100;

// a rarer stat (Luck) costs/sells for more per point than a common one (Health).
export const VALUE_MULTIPLIER_PER_STAT: Record<BaseStat, number> = {
  Agility: 2,
  Constitution: 3,
  Energy: 1,
  Health: 1,
  Intelligence: 5,
  Luck: 10,
  Resistance: 4,
  Spirit: 3,
  Strength: 5,
  Vitality: 4,
};

export const VALUE_MULTIPLIER_PER_RESISTANCE: Record<StatusEffectTag, number> =
  {
    Stun: 6,
    StatDown: 7,
    Accuracy: 3,
    DamageOverTime: 10,
    Poison: 3,
    Burn: 5,
  };

export const VALUE_MULTIPLIER_PER_COMBAT_STAT: Record<CombatStat, number> = {
  repeatActionChance: 5,
  skillStrikeAgainChance: 6,
  redirectionChance: 1,
  missChance: 1,
  debuffIgnoreChance: 7,
  damageReflectPercent: 3,
  healingIgnorePercent: 1,
  reviveChance: 10,
  stunChance: 1,
  agroValue: 2,
};

// Kingdom

// Same rate infusion pricing uses, plus a per-level component so higher-tier drops are worth more.
export const SELL_GOLD_PER_STAT_POINT = 20;
export const SELL_GOLD_PER_LEVEL = 10;

// Combat stats are rarer/more specialized than a raw base stat point, so they're worth more.
export const SELL_GOLD_PER_COMBAT_STAT_POINT = 50;

// Same rate infusion pricing uses for a resistance point - the rarest, most specialized bonus.
export const SELL_GOLD_PER_RESISTANCE_POINT = 100;

// Only one spell can be active for now - raising this later is a one-line change.
export const MAX_ACTIVE_ASTRAL_PROJECTOR_SPELLS = 1;

// Pathfinding

// Path tiles are cheaper than other open tiles so pathfinding hugs authored paths without blocking off-road.
export const ON_PATH_MOVE_COST = 1;
export const OFF_PATH_MOVE_COST = 4;

// Pixi

export const GATHER_VFX_LIFETIME_MS = 1100;
export const GATHER_VFX_FLOAT_DISTANCE = 40;
export const GATHER_VFX_JITTER_RANGE = 30;
export const INDICATOR_PROGRESS_BAR_HEIGHT = 6;
export const INDICATOR_PROGRESS_BAR_OFFSET_Y = -40;
export const NODE_STATUS_ICON_RADIUS = 7;

// How far each trailing party member's screen position lags behind the leader's, in party order (position 2 = 1x, position 3 = 2x, ...).
export const PARTY_FORMATION_FOLLOW_DELAY_MS = 450;
// How long a follower takes to converge onto the node tile once the leader visually arrives, so the party doesn't wait out its full follow delay to settle.
export const PARTY_FORMATION_CATCHUP_MS = 250;
// Leader-position sample buffer only needs to cover the longest follow delay in use, plus headroom.
export const PARTY_FORMATION_HISTORY_MAX_AGE_MS = 2400;
// Followers are placed at a randomized radius (tiles) in this range, spread evenly by angle around the
// leader - the nonzero minimum is what actually guarantees no two sprites ever land on the same spot.
export const PARTY_FORMATION_JITTER_MIN_TILES = 0.4;
export const PARTY_FORMATION_JITTER_MAX_TILES = 0.6;

// Town

// No authored weight value exists yet - a specialty recipe is this many times as likely to be picked as a non-specialty one.
export const SPECIALTY_RECIPE_WEIGHT = 3;
export const TOWN_SPECIALTY_PRIORITY_TICK_INTERVAL = 1;
export const TOWN_PRIORITY_WEIGHT_PER_FAILURE = 0.5;
export const TOWN_PRIORITY_MAX_FAILURES_FOR_WEIGHT = 20;

// Uncapped - the dedicated specialty commission should keep escalating for as long as its recipe keeps failing.
export const TOWN_SPECIALTY_COMMISSION_WEIGHT_PER_FAILURE = 1;

// Runs every tick once activated, same reasoning as WORKER_TICK_INTERVAL - craft progress is continuous.
export const CRAFT_TICK_INTERVAL = 1;
export const RAID_LOSS_CRAFT_DEBUFF_MULTIPLIER = 2;
export const RAID_WIN_REPUTATION_AMOUNT = 100;
export const RAID_LOSS_REPUTATION_AMOUNT = 50;
export const RAID_LOSS_CRAFT_DEBUFF_TICKS = 3600;

// Raiders take 1 to (this % of the town's stock cap, not its current stock count) random stock entries.
export const RAID_LOSS_STOCK_MAX_STEAL_PERCENT = 50;

// Raiders take this % of every material stack the town is holding.
export const RAID_LOSS_MATERIAL_STEAL_PERCENT = 50;

// Re-check cadence, not the actual cap - see RAID_COOLDOWN_TICKS for that.
export const RAID_CHECK_INTERVAL_TICKS = 60;
export const RAID_COOLDOWN_TICKS = 14400;
export const RAID_BASE_WARNING_TICKS = 300;
export const RAID_WARNING_TICKS_PER_MAP_HOP = 120;
export const RAID_WARNING_TICKS_PER_REPUTATION_TIER = 60;

// Checking stock ages is cheap - run every tick so an expired entry disappears promptly, not in whatever-tick-interval batches.
export const SHOP_TICK_INTERVAL = 1;

// Same cadence as every other town subsystem (worker/craft/shop).
export const TOWN_COMMISSION_TICK_INTERVAL = 1;

// Runs every tick once activated - worker travel/gathering progress continuously.
// Raising this is a blunt slowdown on the whole worker economy - it advances per-tick progress by +1 regardless of how many real ticks elapsed since the last run.
export const WORKER_TICK_INTERVAL = 1;

// Worker pauses this long between filling up and hauling back
export const TOWN_WORKER_REST_TICKS = 30;

// Honored - the minimum reputation tier at which a town can be designated home.
export const TOWN_HOME_MIN_REPUTATION_TIER = 2;

// Worker

export const WORKER_MAX_LEVEL = 99;
export const WORKER_XP_START = 10;
export const WORKER_XP_END = 10000;
