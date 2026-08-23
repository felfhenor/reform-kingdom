import { armoryGet } from '@helpers/armory';
import { autoModeProcessTick } from '@helpers/auto-mode';
import { combatDoCombatIteration, currentCombat } from '@helpers/combat';
import { combatLog } from '@helpers/combat-log';
import { craftProcessTick } from '@helpers/crafting-queue';
import { decreeClauses } from '@helpers/decree';
import {
  mostChallengingExploreNodeForRisk,
  pickNextClause,
} from '@helpers/decree-evaluation';
import { encounterRandomProcessTick } from '@helpers/encounter-random-tick';
import { canModifyEquipment } from '@helpers/equipment';
import { gatheringProcessTick, partyMinLevel } from '@helpers/gathering';
import { globalEffectsProcessTick } from '@helpers/global-effects';
import { getGoldQuantity } from '@helpers/materials';
import { CHARACTER_MAX_LEVEL, partyGet } from '@helpers/party';
import { restingProcessTick } from '@helpers/resting';
import {
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  updateGamestate,
} from '@helpers/state-game';
import { travelProcessTick } from '@helpers/travel';
import {
  isPlayerAtKingdom,
  worldNodeAtCurrentLocation,
} from '@helpers/world';
import { worldNodeEncounter } from '@helpers/world-nodes';
import type {
  CharacterId,
  CombatLog,
  EquipmentItemId,
  GameState,
} from '@interfaces';
import {
  HARD_STONEWALL_TICKS,
  SUPPLY_STALL_TICKS,
  TICKS_PER_HOUR,
  VERBOSE_STATUS_INTERVAL_TICKS,
  XP_DECAY_LEVEL_GAP,
  XP_DECAY_TICKS,
} from './constants';
import {
  applyStrategyPolicy,
  isGatherTimeBudgetExhausted,
  reoptimizeAllEquipment,
} from './strategy';
import type { ScenarioConfig, SimResult, StonewallEvent } from './types';

export type StonewallHandler = (
  event: StonewallEvent,
  stateSnapshot: GameState,
) => void;

type TrackerState = {
  idleNoClauseTicks: number;
  xpDecayTicks: number;
  supplyStallSinceTick: number | null;
  loggedXpDecay: boolean;
  loggedSupplyStall: boolean;
};

function freshTracker(): TrackerState {
  return {
    idleNoClauseTicks: 0,
    xpDecayTicks: 0,
    supplyStallSinceTick: null,
    loggedXpDecay: false,
    loggedSupplyStall: false,
  };
}

// Best reachable node's max challenge level vs. the party's weakest member -
// mirrors the private `worldNodeChallengeLevel` in decree-evaluation.ts,
// applied to the node that function itself would pick. 'High' matches the
// fixed risk tolerance `configureStrategyDecree` (strategy.ts) always gives
// the sim's `LevelUpParty` clause, so this reflects the same node that
// clause is actually pursuing.
function bestReachableChallengeLevel(): number | undefined {
  const node = mostChallengingExploreNodeForRisk('High');
  if (!node) return undefined;

  return worldNodeEncounter(node)?.levelRange.max;
}

// Runs one game tick's worth of processing - the same sequence
// `gameloop.ts` wraps, called directly instead of through `gameloop()`
// (which is gated on `window.location` including `/game`, an Angular-router
// artifact with no headless equivalent).
function processOneTick(): void {
  updateGamestate((state) => {
    state.clock.numTicks += 1;
    return state;
  });

  travelProcessTick();
  globalEffectsProcessTick();
  gatheringProcessTick();
  encounterRandomProcessTick();
  autoModeProcessTick();
  craftProcessTick();
  restingProcessTick();

  if (currentCombat()) {
    combatDoCombatIteration();
  }
}

function checkHardStonewall(tracker: TrackerState): boolean {
  const nothingSatisfiable = !pickNextClause(decreeClauses());
  const idleAtKingdom = isPlayerAtKingdom();

  if (nothingSatisfiable && idleAtKingdom) {
    tracker.idleNoClauseTicks += 1;
  } else {
    tracker.idleNoClauseTicks = 0;
  }

  return tracker.idleNoClauseTicks >= HARD_STONEWALL_TICKS;
}

function checkXpDecay(tracker: TrackerState): StonewallEvent | undefined {
  const challengeLevel = bestReachableChallengeLevel();
  const partyLevel = partyMinLevel();
  const isDecaying =
    challengeLevel !== undefined &&
    partyLevel - challengeLevel >= XP_DECAY_LEVEL_GAP;

  if (isDecaying) {
    tracker.xpDecayTicks += 1;
  } else {
    tracker.xpDecayTicks = 0;
    tracker.loggedXpDecay = false;
  }

  if (
    isDecaying &&
    tracker.xpDecayTicks >= XP_DECAY_TICKS &&
    !tracker.loggedXpDecay
  ) {
    tracker.loggedXpDecay = true;
    return {
      kind: 'XpDecay',
      tick: gamestate().clock.numTicks,
      detail: `Party level ${partyLevel} is ${
        partyLevel - challengeLevel!
      } levels above the hardest reachable node (max ${challengeLevel}) - XP gain has decayed toward the floor.`,
    };
  }

  return undefined;
}

function checkSupplyStall(
  tracker: TrackerState,
  craftResult: ReturnType<typeof applyStrategyPolicy>,
  tick: number,
): StonewallEvent | undefined {
  if (!craftResult) return undefined;

  // Requires *both* signals: recipes unlocked with nothing craftable, *and*
  // the party has already spent its whole gather-time budget actively
  // seeking materials and still come up short (`isGatherTimeBudgetExhausted`
  // in strategy.ts). Used to gate on "no gatherable material source
  // discovered anywhere yet" instead, but every GatherNode is now
  // pre-discovered from tick 1 (`discoverAllGatherNodesForSimulation` in
  // run.ts, needed for the standing `GatherMaterial` clauses to work at
  // all) - that made `gatherableMaterialIds().length === 0` permanently
  // false, silently turning this stonewall detector into dead code.
  const isStalled =
    craftResult.anyRecipeUnlocked &&
    !craftResult.anyQueued &&
    isGatherTimeBudgetExhausted();

  if (!isStalled) {
    tracker.supplyStallSinceTick = null;
    tracker.loggedSupplyStall = false;
    return undefined;
  }

  tracker.supplyStallSinceTick ??= tick;

  if (
    tick - tracker.supplyStallSinceTick >= SUPPLY_STALL_TICKS &&
    !tracker.loggedSupplyStall
  ) {
    tracker.loggedSupplyStall = true;
    return {
      kind: 'SupplyStall',
      tick: gamestate().clock.numTicks,
      detail:
        'A tradeskill has recipes unlocked but none craftable for a sustained stretch - required materials likely have no discovered gather source.',
    };
  }

  return undefined;
}

// Equips any upgrade the moment new gear shows up in the armory - crafted
// (see `attemptTargetedCrafting` in strategy.ts) or looted from combat/node
// rewards, both land in `armory` the same way. `optimizeCharacterEquipment`
// (called via `reoptimizeAllEquipment`) is already a no-op per slot when
// nothing new beats what's equipped, so this only needs to fire once per
// tick that *anything* new appeared, not once per item.
//
// Skips entirely while equipment can't be modified (mid-combat -
// `canModifyEquipment`) rather than marking newly-seen items as seen anyway:
// a multi-fight encounter grants rewards after each fight it wins, not just
// the last one (`combat-end.ts`), so gear can land in the armory while
// `currentCombat()` is still truthy for the remaining fights. Leaving those
// ids unseen means the first tick after combat actually ends will pick them
// up correctly, instead of the id being marked "seen" now and the party
// silently never getting a real chance to equip it.
function checkForNewEquipment(seenItemIds: Set<EquipmentItemId>): void {
  if (!canModifyEquipment()) return;

  let hasNew = false;

  armoryGet().forEach((item) => {
    if (!seenItemIds.has(item.id)) {
      hasNew = true;
      seenItemIds.add(item.id);
    }
  });

  if (hasNew) reoptimizeAllEquipment();
}

function describePartyLocation(): string {
  const travel = gamestate().world.travel;
  if (travel.status === 'Traveling') {
    return `traveling to ${travel.destinationNodeName ?? 'unknown'}`;
  }
  if (isPlayerAtKingdom()) return 'at the kingdom';

  const node = worldNodeAtCurrentLocation();
  return node ? `at ${node.nodeName}` : 'in the field';
}

// `--verbose`-only progress line, printed every `VERBOSE_STATUS_INTERVAL_TICKS`
// - gives a sense of what the party is doing/thinking over a run that can
// otherwise go for hundreds of thousands of silent ticks.
function logVerboseStatus(label: string, tick: number): void {
  const simulatedHours = Math.round((tick / TICKS_PER_HOUR) * 100) / 100;
  const activeClause = pickNextClause(decreeClauses());

  console.log(
    `[${label}] tick ${tick} (${simulatedHours}h): level ${partyMinLevel()}, ` +
      `${describePartyLocation()}, ${currentCombat() ? 'in combat' : 'not in combat'}, ` +
      `gold ${getGoldQuantity()}, pursuing ${activeClause?.type ?? 'nothing (idle)'}`,
  );
}

// `--verbose`-only per-character level-up notice, checked every tick against
// a snapshot taken at scenario start. Cheap even every tick - `partyGet()` is
// a handful of characters, not a scan of anything large.
function logLevelUps(
  label: string,
  previousLevels: Map<CharacterId, number>,
): void {
  partyGet().forEach((character) => {
    const previous = previousLevels.get(character.id);
    if (previous !== undefined && character.level > previous) {
      console.log(
        `[${label}] ${character.name} leveled up: ${previous} -> ${character.level}`,
      );
    }
    previousLevels.set(character.id, character.level);
  });
}

// The real game already narrates combat outcomes/travel arrivals/crafts into
// `combatLog` (the in-game adventure log) - `--verbose` just tails it instead
// of re-deriving the same events from raw state. `lastSeenMessageId` scopes
// each scenario to only what it itself produced, since `combatLog` isn't
// reset between scenarios (it's a `localStorageSignal`, not part of
// `GameState`).
// Only the subset of adventure-log entries that answer "what is the party
// doing/thinking" at a glance - not every attack roll or turn-order message.
function describeAdventureLogEntry(entry: CombatLog): string | undefined {
  const message = entry.message.replace(/\*\*/g, '');

  if (entry.kind === 'Combat') {
    return /won the combat|lost the combat/i.test(message)
      ? message
      : undefined;
  }
  if (entry.kind === 'Travel') {
    return /arrived at/i.test(message) ? message : undefined;
  }
  if (entry.kind === 'Craft') return message;

  return undefined;
}

function logAdventureLogTail(
  label: string,
  lastSeenMessageId: string | undefined,
): string | undefined {
  const logs = combatLog();
  if (logs.length === 0) return lastSeenMessageId;

  const cutoffIndex = lastSeenMessageId
    ? logs.findIndex((entry) => entry.messageId === lastSeenMessageId)
    : -1;

  // `lastSeenMessageId` was set but has fallen out of the log's 500-entry
  // cap - more entries landed since the last check than the cap can hold.
  // The missing entries are unrecoverable, and replaying the entire current
  // backlog would look like a duplicate flood rather than a one-off gap, so
  // skip printing this pass and just resync the pointer below instead of
  // getting stuck retrying the same stale id forever.
  if (lastSeenMessageId === undefined || cutoffIndex !== -1) {
    const newEntries = [
      ...logs.slice(0, cutoffIndex === -1 ? logs.length : cutoffIndex),
    ].reverse();

    newEntries.forEach((entry) => {
      const description = describeAdventureLogEntry(entry);
      if (description) console.log(`[${label}] ${description}`);
    });
  }

  return logs[0].messageId;
}

// Runs `scenario.tickBudget` ticks (or until the party maxes out every
// level, or a hard stonewall is confirmed) against whatever `GameState` is
// already live - the caller is responsible for `gameReset`/`setParty`/
// `gameStart` beforehand. Must run inside the process that already imported
// `./shims` and called `bootstrapContent()`.
export function runScenario(
  scenario: ScenarioConfig,
  onStonewall?: StonewallHandler,
  verbose = false,
): SimResult {
  const tracker = freshTracker();
  const stonewalls: StonewallEvent[] = [];

  const label = `${scenario.comp.label} (${scenario.strategy} trial ${scenario.trial})`;
  const previousLevels = new Map(
    partyGet().map((character) => [character.id, character.level]),
  );
  const seenArmoryItemIds = new Set(armoryGet().map((item) => item.id));
  // Scopes the adventure-log tail to only what *this* scenario produces -
  // `combatLog` is a `localStorageSignal` that persists across scenarios, so
  // starting from `undefined` would replay the previous scenario's tail too.
  let lastSeenMessageId: string | undefined = combatLog()[0]?.messageId;

  const emit = (event: StonewallEvent) => {
    stonewalls.push(event);
    onStonewall?.(event, structuredClone(gamestate()));
  };

  gamestateTickStart();

  let tick = 0;
  let terminalReason: SimResult['terminalReason'] = 'TickBudget';

  // `gamestateTickEnd()` must run even if a helper throws mid-tick - it's
  // what clears the module-level tick draft in state-game.ts. Skipping it
  // would leave that draft dangling, and since `gamestate()` prefers it over
  // the committed state, the *next* scenario's `gameReset()` would silently
  // read/write against this crashed scenario's stale state instead of a
  // fresh one.
  try {
    for (tick = 1; tick <= scenario.tickBudget; tick++) {
      processOneTick();
      checkForNewEquipment(seenArmoryItemIds);

      if (verbose) {
        if (tick % VERBOSE_STATUS_INTERVAL_TICKS === 0) {
          logVerboseStatus(label, tick);
        }
        logLevelUps(label, previousLevels);
        lastSeenMessageId = logAdventureLogTail(label, lastSeenMessageId);
      }

      const craftResult = applyStrategyPolicy(
        scenario.strategy,
        tick,
        scenario.tickBudget,
      );

      const xpDecayEvent = checkXpDecay(tracker);
      if (xpDecayEvent) emit(xpDecayEvent);

      const supplyStallEvent = checkSupplyStall(tracker, craftResult, tick);
      if (supplyStallEvent) emit(supplyStallEvent);

      if (partyMinLevel() >= CHARACTER_MAX_LEVEL) {
        terminalReason = 'MaxLevel';
        break;
      }

      if (checkHardStonewall(tracker)) {
        terminalReason = 'Stonewall';
        emit({
          kind: 'HardStonewall',
          tick: gamestate().clock.numTicks,
          detail:
            'No Decree clause has been satisfiable and the party has been idle at the kingdom for ' +
            `${HARD_STONEWALL_TICKS} consecutive ticks - nothing reachable to progress on.`,
        });
        break;
      }
    }
  } finally {
    gamestateTickEnd();
  }

  return {
    scenario,
    finalTick: gamestate().clock.numTicks,
    terminalReason,
    finalPartyLevel: partyMinLevel(),
    stonewalls,
  };
}
