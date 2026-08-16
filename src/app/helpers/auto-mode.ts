import { analyticsSendDesignEvent } from '@helpers/analytics';
import { currentCombat } from '@helpers/combat';
import { getEntry } from '@helpers/content';
import {
  decreeClauses,
  decreeRiskTolerance,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree';
import { farmNodeRewardQuantity } from '@helpers/decree-farm-node';
import {
  clauseTargetNode,
  isClauseBlockedOnlyByHealth,
  pickNextClause,
} from '@helpers/decree-evaluation';
import { gatheringStop, isGathering } from '@helpers/gathering';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/global-effects';
import { getMaterialQuantity } from '@helpers/materials';
import { isPartyAtFullHealth } from '@helpers/party';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { travelStart } from '@helpers/travel';
import { isPlayerAtKingdom } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node-gathering';
import { rewardContentInfo } from '@helpers/world-node-rewards';
import { worldNodeByName, worldNodesOfType } from '@helpers/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  GlobalEffectContent,
  GlobalEffectId,
  ItemContent,
} from '@interfaces';

// Long enough that the Auto Mode global effect never expires on its own -
// it's granted/revoked explicitly by `syncAutoModeGlobalEffect` below, based
// on `autoMode.enabled`, the same "~1 year" trick `resting.ts` uses for Idle.
const AUTO_MODE_EFFECT_DURATION_TICKS = 60 * 60 * 24 * 365;

export function autoModeIsEnabled(): boolean {
  return gamestate().world.autoMode.enabled;
}

export function autoModeToggle(enabled: boolean): void {
  updateGamestate((state) => {
    state.world.autoMode.enabled = enabled;
    if (!enabled) state.world.autoMode.activeClauseId = undefined;
    return state;
  });
}

function setActiveClause(clauseId?: DecreeClauseId): void {
  updateGamestate((state) => {
    state.world.autoMode.activeClauseId = clauseId;
    return state;
  });
}

export function autoModeRecordClauseFailure(): void {
  const activeClauseId = gamestate().world.autoMode.activeClauseId;
  if (!activeClauseId) return;

  updateGamestate((state) => {
    state.world.autoMode.clauses = state.world.autoMode.clauses.map((clause) =>
      clause.id === activeClauseId
        ? { ...clause, failureCount: clause.failureCount + 1 }
        : clause,
    );
    return state;
  });
}

// Mirrors `autoModeRecordClauseFailure` - a won fight proves the active
// clause is working again, so its streak of prior failures shouldn't keep
// counting against it (and tripping the UI's failure warning) forever.
export function autoModeRecordClauseSuccess(): void {
  const activeClauseId = gamestate().world.autoMode.activeClauseId;
  if (!activeClauseId) return;

  updateGamestate((state) => {
    state.world.autoMode.clauses = state.world.autoMode.clauses.map((clause) =>
      clause.id === activeClauseId ? { ...clause, failureCount: 0 } : clause,
    );
    return state;
  });
}

// Recorded for every lost fight regardless of which clause sent the party
// there - only `LevelUpParty`'s node picker reads this back (see
// `mostChallengingExploreNodeForRisk`), but a node that's losing is losing no
// matter which clause caused the trip.
export function autoModeRecordNodeFailure(nodeName: string): void {
  let newFailureCount = 0;

  updateGamestate((state) => {
    const counts = state.world.autoMode.nodeFailureCounts;
    newFailureCount = (counts[nodeName] ?? 0) + 1;
    state.world.autoMode.nodeFailureCounts = {
      ...counts,
      [nodeName]: newFailureCount,
    };
    return state;
  });

  analyticsSendDesignEvent('World:Node:Fail', newFailureCount);
}

// Mirrors `autoModeRecordNodeFailure` - a won fight clears the node's losing
// streak, the same way a clause-level success clears `failureCount`.
export function autoModeRecordNodeSuccess(nodeName: string): void {
  updateGamestate((state) => {
    state.world.autoMode.nodeFailureCounts = {
      ...state.world.autoMode.nodeFailureCounts,
      [nodeName]: 0,
    };
    return state;
  });
}

// Wipes every node's losing streak - called whenever a hero levels up (see
// `combat-end.ts`'s `partyGainXp` call), since a stronger party may now be
// able to clear a node `mostChallengingExploreNodeForRisk` had previously
// written off, and it deserves a fresh try rather than staying avoided
// forever.
export function autoModeResetNodeFailureCounts(): void {
  updateGamestate((state) => {
    state.world.autoMode.nodeFailureCounts = {};
    return state;
  });
}

function clauseStatusLabel(clause: DecreeClause): string {
  switch (clause.type) {
    case 'GatherMaterial': {
      const item = getEntry<ItemContent>(clause.materialId);
      const current = getMaterialQuantity(clause.materialId);
      return `Gathering ${item?.name ?? 'materials'} (${current.toLocaleString()}/${clause.targetQuantity.toLocaleString()} in stock)...`;
    }
    case 'FarmNode': {
      const reward = rewardContentInfo(clause.reward);
      const current = farmNodeRewardQuantity(clause.reward);
      return `Farming ${clause.nodeName} for ${reward?.name ?? 'reward'} (${current.toLocaleString()}/${clause.targetQuantity.toLocaleString()})...`;
    }
    case 'FinishUnfinishedAreas':
      return 'Seeking unfinished areas...';
    case 'LevelUpParty':
      return `Leveling up (${decreeRiskTolerance()} risk)...`;
    case 'ReturnToKingdom':
      return 'Returning to the kingdom...';
  }
}

export function autoModeStatusLabel(): string | undefined {
  const autoMode = gamestate().world.autoMode;
  if (!autoMode.enabled) return undefined;

  const clause = autoMode.clauses.find(
    (candidate) => candidate.id === autoMode.activeClauseId,
  );
  if (clause) return clauseStatusLabel(clause);

  if (decreeWaitForFullHealthBeforeCombat() && !isPartyAtFullHealth()) {
    return 'Healing before the next move...';
  }

  return 'Idle';
}

function syncAutoModeGlobalEffect(enabled: boolean): void {
  const isEffectActive = isGlobalEffectActive('Auto Mode' as GlobalEffectId);
  if (enabled === isEffectActive) return;

  if (enabled) {
    addGlobalEffect(
      'Auto Mode' as GlobalEffectId,
      AUTO_MODE_EFFECT_DURATION_TICKS,
    );
    return;
  }

  const content = getEntry<GlobalEffectContent>('Auto Mode' as GlobalEffectId);
  if (content) removeGlobalEffect(content.id);
}

// `activeClauseId` is only ever set by `runClause` below, so a gather
// session Auto Mode didn't personally start - because it was already in
// progress the moment Auto Mode was enabled, or the party was already
// idle-gathering for some other reason - is otherwise invisible to
// `stopGatherIfTargetReached`, which would then never notice the target was
// met and let it run forever. This adopts any in-progress gather that
// matches an enabled GatherMaterial clause, so the stop-check below always
// has an active clause to work with while gathering is underway.
function adoptInProgressGatherClause(): void {
  const autoMode = gamestate().world.autoMode;
  if (autoMode.activeClauseId) return;

  const gathering = gamestate().world.gathering;
  if (gathering.status !== 'Gathering' || !gathering.nodeName) return;

  const node = worldNodeByName(gathering.nodeName);
  if (!node) return;

  const nodeMaterialIds = worldNodeGatherMaterialIds(node);
  const matchingClause = autoMode.clauses.find(
    (clause) =>
      clause.enabled &&
      clause.type === 'GatherMaterial' &&
      nodeMaterialIds.includes(clause.materialId),
  );
  if (!matchingClause) return;

  setActiveClause(matchingClause.id);
}

// Once a `GatherMaterial` clause's target is reached, gathering has no
// natural stop condition of its own (it loops forever) - this is what ends
// it and hands control back to the next tick's clause re-evaluation.
function stopGatherIfTargetReached(): void {
  const autoMode = gamestate().world.autoMode;
  if (!autoMode.activeClauseId) return;
  if (gamestate().world.gathering.status !== 'Gathering') return;

  const clause = autoMode.clauses.find(
    (candidate) => candidate.id === autoMode.activeClauseId,
  );
  if (!clause || clause.type !== 'GatherMaterial') return;
  if (getMaterialQuantity(clause.materialId) < clause.targetQuantity) return;

  gatheringStop();
  setActiveClause(undefined);
}

function isPartyIdleForAutoMode(): boolean {
  return (
    gamestate().world.travel.status === 'Idle' &&
    !isGathering() &&
    !currentCombat()
  );
}

// A gather session with no clause behind it (started manually, or its
// GatherMaterial clause no longer matches, was disabled, etc.) has no
// natural stop condition of its own - unlike a clause-tracked gather, which
// `stopGatherIfTargetReached` ends once its target is hit. Left alone it
// loops forever, so `isPartyIdleForAutoMode` never sees the party as idle
// and `advanceToNextClause` never runs again - Auto Mode is permanently
// stuck at that node regardless of health. Ending the gather here hands
// control straight back to the normal per-tick evaluation below, which
// decides what happens next.
//
// A hurt party waiting on the "wait for full health" gate is a special case
// of this: `restingProcessTick` also requires `!isGathering()`, so on top of
// blocking clause evaluation, an orphaned gather silently breaks the
// "Healing before the next move..." promise `autoModeStatusLabel` shows for
// that state. Ending the gather alone isn't enough there, though -
// `advanceToNextClause`'s blocked-only-by-health branch can never fire from
// this path (it requires the same health-blocked condition this function
// just found to be false), so a GatherNode would otherwise be treated as
// "nothing to do" rather than "waiting to heal." Route through the kingdom
// explicitly instead.
function stopOrphanedGather(): boolean {
  const autoMode = gamestate().world.autoMode;
  if (!isGathering()) return false;

  const activeClause = autoMode.clauses.find(
    (candidate) => candidate.id === autoMode.activeClauseId,
  );
  if (activeClause?.enabled) return false;

  gatheringStop();

  if (decreeWaitForFullHealthBeforeCombat() && !isPartyAtFullHealth()) {
    returnToKingdomFallback();
    return true;
  }

  return false;
}

function runClause(clause: DecreeClause): void {
  setActiveClause(clause.id);

  if (clause.type === 'ReturnToKingdom') {
    const kingdom = worldNodesOfType('Kingdom')[0];
    if (kingdom) travelStart(kingdom.nodeName, true);
    return;
  }

  const target = clauseTargetNode(clause);
  if (target) travelStart(target.nodeName, true);
}

// No enabled clause is satisfiable (including an empty Decree) - park at the
// kingdom rather than leaving the party stuck wherever they last were. Not
// tracked as an active clause, so it never accrues failures.
function returnToKingdomFallback(): void {
  setActiveClause(undefined);
  if (isPlayerAtKingdom()) return;

  const kingdom = worldNodesOfType('Kingdom')[0];
  if (kingdom) travelStart(kingdom.nodeName, true);
}

function advanceToNextClause(): void {
  const clauses = decreeClauses();
  const clause = pickNextClause(clauses);
  if (clause) {
    runClause(clause);
    return;
  }

  // Nothing satisfiable purely because the "wait for full health" gate is
  // holding it back - stay put and let `restingProcessTick` heal the party
  // wherever they already are, rather than trekking back to the kingdom.
  if (clauses.some(isClauseBlockedOnlyByHealth)) {
    setActiveClause(undefined);
    return;
  }

  returnToKingdomFallback();
}

export function autoModeProcessTick(): void {
  const enabled = autoModeIsEnabled();
  syncAutoModeGlobalEffect(enabled);
  if (!enabled) return;

  adoptInProgressGatherClause();
  stopGatherIfTargetReached();
  if (stopOrphanedGather()) return;
  if (!isPartyIdleForAutoMode()) return;

  advanceToNextClause();
}
