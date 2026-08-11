// Tunable knobs for the simulator, gathered in one place rather than spread
// across driver.ts/strategy.ts/party-comps.ts/run.ts.

// 1 tick == 1 simulated real-time second at 1x game speed (`gameloop.ts` is
// driven by a 1-second `interval` calling `gameloop(secondsElapsed)` - see
// `gamestate.service.ts`). This ratio holds regardless of how fast the
// simulator itself runs, so a tick count always converts to a genuine
// "hours the player would have had to sit through" figure.
export const TICKS_PER_HOUR = 3600;

// Party size a comp is built for - matches `STARTING_HERO_NAMES.length` in
// `game-setup-world.component.ts`.
export const PARTY_SIZE = 4;

export const DEFAULT_TICK_BUDGET = 500_000;
export const DEFAULT_TRIALS = 5;

// --- driver.ts stonewall/decay detection thresholds ---

// Mirrors `xpForOverLevel` (monster.ts)'s decay onset - 4+ levels above the
// hardest reachable node's max level is where XP gain has already started
// collapsing toward the floor, even though the party is technically still
// "succeeding" at every fight.
export const XP_DECAY_LEVEL_GAP = 4;

// Consecutive ticks a condition must hold before it's logged - avoids
// flagging a stonewall/decay/stall from a single transient tick (e.g. mid
// travel-step) rather than a genuine stuck state.
export const HARD_STONEWALL_TICKS = 500;
export const XP_DECAY_TICKS = 500;

// Supply stall needs a much longer sustained window than the others:
// "recipes unlocked but nothing craftable" is also just what a brand-new
// game looks like before the party has walked past its first gather node,
// so a short window mostly measures startup lag rather than a genuine dead
// end.
export const SUPPLY_STALL_CRAFT_CHECKS = 200;

// --- strategy.ts play-skill preset knobs ---

// A fresh party thrown straight at `High` risk (up to 7 levels above them,
// per `HIGH_RISK_LEVELS_ABOVE_PARTY` in decree-evaluation.ts) mostly just
// loses repeatedly and never progresses - Optimal instead ramps risk
// tolerance up as the party actually gets sturdier.
export const OPTIMAL_RISK_LOW_LEVEL_CEILING = 5;
export const OPTIMAL_RISK_MEDIUM_LEVEL_CEILING = 15;

export const OPTIMAL_CRAFT_INTERVAL_TICKS = 10;
export const OPTIMAL_INFUSE_INTERVAL_TICKS = 10;

export const AVERAGE_CRAFT_INTERVAL_TICKS = 50;
export const AVERAGE_INFUSE_INTERVAL_TICKS = 50;
export const AVERAGE_REOPTIMIZE_INTERVAL_TICKS = 500;
