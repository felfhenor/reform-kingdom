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

export const DEFAULT_TICK_BUDGET = 50_000;
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
// end. Measured in elapsed ticks (not craft-attempt checks) specifically so
// it means the same thing regardless of a strategy tier's crafting cadence -
// `always-craft` checks every tick and `periodic-craft` every 50, and a
// check-count threshold would make the same real stall trip 50x faster for
// one tier than the other.
export const SUPPLY_STALL_TICKS = 10_000;

// --- strategy.ts crafting-tier preset knobs ---

// `always-craft` runs the crafting/infusion policy every tick - "as often as
// possible" - naturally self-limiting once queues fill up or materials run
// out (see `craftQueueStart`'s queue-size cap in crafting-queue.ts).
export const ALWAYS_CRAFT_INTERVAL_TICKS = 1;
export const ALWAYS_INFUSE_INTERVAL_TICKS = 1;

// `periodic-craft` runs the exact same targeting policy as `always-craft`
// (see `attemptTargetedCrafting` in strategy.ts) but on a slow cadence -
// frequency is the only variable between the two tiers, so a run comparing
// them isolates "how much does crafting *often* matter" cleanly.
export const PERIODIC_CRAFT_INTERVAL_TICKS = 50;
export const PERIODIC_INFUSE_INTERVAL_TICKS = 50;

// How large a stockpile each standing `GatherMaterial` Decree clause targets
// before falling through to the next clause (see `configureStrategyDecree`).
// Generous enough that a single gathering trip funds several crafting
// batches rather than the party bouncing between "gather a little" and
// "craft it away" every other check.
export const GATHER_MATERIAL_TARGET_QUANTITY = 50;

// Worst-case ticks a single `GatherMaterial` clause is allowed to stay
// active before `strategy.ts` force-disables it - a quantity target alone
// isn't bounded in time, since gather-node yield rates vary wildly by
// material (confirmed via a live run: Carrina Copper Mines rolls Copper Ore
// at 30% per 5-tick cycle but Malachite at only 1%, so a fixed target of 50
// could take ~830 ticks for one and ~25,000 for the other from the exact
// same node). Mirrors the same bounded-circuit-breaker idiom as
// `HARD_STONEWALL_TICKS`/`XP_DECAY_TICKS`/`SUPPLY_STALL_TICKS` above - rare
// materials still trickle in via incidental combat/encounter drops, they
// just don't get the party's active, undivided gathering time indefinitely.
export const GATHER_TIMEOUT_TICKS = 1500;

// Total fraction of a scenario's tick budget the party will ever spend with
// an active `GatherMaterial` clause, cumulative across every material -
// `GATHER_TIMEOUT_TICKS` alone bounds one clause at a time, but doesn't stop
// several materials from rotating through it indefinitely: crafting resumes
// the moment gathering pauses (between nodes, between clause switches), and
// can drag an already-hit target back under threshold before the party
// fully disengages, so with multiple materials in play some clause is
// almost always unsatisfied and `LevelUpParty` never wins (confirmed via a
// live run - a party kept bouncing between 3 gather nodes for an entire
// 20,000-tick test without ever leveling past 4). Once the party has spent
// this fraction of the whole run actively gathering, every `GatherMaterial`
// clause is disabled for the rest of the scenario - crafting still gets
// whatever it already stockpiled, plus whatever trickles in from incidental
// combat/encounter drops, it just stops getting the party's dedicated
// gathering time.
//
// Assumes `tickBudget * GATHER_TIME_BUDGET_FRACTION` stays comfortably above
// `GATHER_TIMEOUT_TICKS` (true for `DEFAULT_TICK_BUDGET`: 75,000 vs. 1,500) -
// for a much smaller custom `--tick-budget`, the global budget can trip
// before any single clause's own timeout ever would, making the per-clause
// timeout a no-op for that run. Harmless (the global budget still bounds
// things correctly either way), just worth knowing if a short smoke-test run
// ever looks like the per-clause timeout "isn't firing."
export const GATHER_TIME_BUDGET_FRACTION = 0.15;

// --- run.ts/driver.ts `--verbose` status output ---

// How often (in simulated ticks) `--verbose` prints a status line for the
// running scenario - frequent enough to see progress, not so frequent it
// floods the terminal over a multi-hundred-thousand-tick run.
export const VERBOSE_STATUS_INTERVAL_TICKS = 600;
