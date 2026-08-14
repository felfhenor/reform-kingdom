import { autoModeProcessTick } from '@helpers/auto-mode';
import { combatDoCombatIteration, currentCombat } from '@helpers/combat';
import { craftProcessTick } from '@helpers/crafting-queue';
import { decreeClauses } from '@helpers/decree';
import {
  mostChallengingExploreNodeForRisk,
  pickNextClause,
} from '@helpers/decree-evaluation';
import { encounterRandomProcessTick } from '@helpers/encounter-random-tick';
import { gatheringProcessTick, partyMinLevel } from '@helpers/gathering';
import { globalEffectsProcessTick } from '@helpers/global-effects';
import { CHARACTER_MAX_LEVEL, partyGet } from '@helpers/party';
import { restingProcessTick } from '@helpers/resting';
import {
  gamestate,
  gamestateTickEnd,
  gamestateTickStart,
  updateGamestate,
} from '@helpers/state-game';
import { travelProcessTick } from '@helpers/travel';
import { isPlayerAtKingdom } from '@helpers/world';
import { gatherableMaterialIds } from '@helpers/world-node-gathering';
import { worldNodeEncounter } from '@helpers/world-nodes';
import type { GameState } from '@interfaces';
import { sumBy } from 'es-toolkit/compat';
import {
  HARD_STONEWALL_TICKS,
  SUPPLY_STALL_CRAFT_CHECKS,
  XP_DECAY_LEVEL_GAP,
  XP_DECAY_TICKS,
} from './constants';
import { applyStrategyPolicy } from './strategy';
import type { ScenarioConfig, SimResult, StonewallEvent } from './types';

export type StonewallHandler = (
  event: StonewallEvent,
  stateSnapshot: GameState,
) => void;

type TrackerState = {
  idleNoClauseTicks: number;
  xpDecayTicks: number;
  supplyStallChecks: number;
  loggedXpDecay: boolean;
  loggedSupplyStall: boolean;
};

function freshTracker(): TrackerState {
  return {
    idleNoClauseTicks: 0,
    xpDecayTicks: 0,
    supplyStallChecks: 0,
    loggedXpDecay: false,
    loggedSupplyStall: false,
  };
}

// Best reachable node's max challenge level vs. the party's weakest member -
// mirrors the private `worldNodeChallengeLevel` in decree-evaluation.ts,
// applied to the node that function itself would pick.
function bestReachableChallengeLevel(): number | undefined {
  const node = mostChallengingExploreNodeForRisk();
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
): StonewallEvent | undefined {
  if (!craftResult) return undefined;

  // Requires *both* signals: recipes unlocked with nothing craftable, *and*
  // no gatherable material source discovered anywhere yet. Either one alone
  // is also just what a brand-new game looks like for its first stretch.
  const isStalled =
    craftResult.anyRecipeUnlocked &&
    !craftResult.anyQueued &&
    gatherableMaterialIds().length === 0;
  if (isStalled) {
    tracker.supplyStallChecks += 1;
  } else {
    tracker.supplyStallChecks = 0;
    tracker.loggedSupplyStall = false;
  }

  if (
    isStalled &&
    tracker.supplyStallChecks >= SUPPLY_STALL_CRAFT_CHECKS &&
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

function totalPartyLevel(): number {
  return sumBy(partyGet(), (character) => character.level);
}

// Runs `scenario.tickBudget` ticks (or until the party maxes out every
// level, or a hard stonewall is confirmed) against whatever `GameState` is
// already live - the caller is responsible for `gameReset`/`setParty`/
// `gameStart` beforehand. Must run inside the process that already imported
// `./shims` and called `bootstrapContent()`.
export function runScenario(
  scenario: ScenarioConfig,
  onStonewall?: StonewallHandler,
): SimResult {
  const tracker = freshTracker();
  const stonewalls: StonewallEvent[] = [];
  let previousTotalLevel = totalPartyLevel();

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

      const currentTotalLevel = totalPartyLevel();
      const leveledUp = currentTotalLevel > previousTotalLevel;
      previousTotalLevel = currentTotalLevel;

      const craftResult = applyStrategyPolicy(
        scenario.strategy,
        tick,
        leveledUp,
      );

      const xpDecayEvent = checkXpDecay(tracker);
      if (xpDecayEvent) emit(xpDecayEvent);

      const supplyStallEvent = checkSupplyStall(tracker, craftResult);
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
