import { currentCombat } from '@helpers/combat/combat-state';
import { getEntry } from '@helpers/content';
import {
  decreeClauses,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import {
  clauseTargetNode,
  isClauseBlockedOnlyByHealth,
  pickNextClause,
} from '@helpers/decree/decree-evaluation';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import { isPartyAtFullHealth } from '@helpers/hero/party';
import { travelStart } from '@helpers/hero/travel';
import { gatheringStop, isGathering } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { isPlayerAtKingdom } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import {
  worldNodeByName,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  GlobalEffectContent,
  GlobalEffectId,
  ItemContent,
} from '@interfaces';

// Long enough it never expires on its own; granted/revoked explicitly by `syncAutoModeGlobalEffect` (same "~1 year" trick `resting.ts` uses for Idle).
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

// A won fight proves the clause works again, so its failure streak shouldn't keep tripping the UI's warning forever.
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

// Recorded for every lost fight regardless of clause; only `LevelUpParty`'s node picker reads it back (see `mostChallengingExploreNodeForRisk`).
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

// Called on level-up (see `combat-end.ts`'s `partyGainXp`) so a stronger party gets a fresh try at nodes previously written off.
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
      return `Leveling up (${clause.riskTolerance} risk)...`;
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

// A gather Auto Mode didn't itself start (already in progress when enabled, etc.) has no `activeClauseId`, so `stopGatherIfTargetReached` below would never notice its target was met. Adopts any in-progress gather matching an enabled GatherMaterial clause so the stop-check always has a clause to work with.
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

// Gathering loops forever on its own; this ends it once the target is reached and hands control back to clause re-evaluation.
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

// An orphaned gather (no clause tracking it, e.g. started manually or its clause got disabled) never stops on its own, leaving Auto Mode stuck at that node. Ends it so per-tick evaluation resumes. If the party is also hurt and waiting for full health, routes through the kingdom explicitly - `restingProcessTick` needs `!isGathering()` to heal, and `advanceToNextClause`'s health-blocked branch can't fire from this path.
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

// Parks at the kingdom when no clause is satisfiable, rather than leaving the party stuck. Not tracked as an active clause, so it never accrues failures.
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

  // Blocked only by the health gate - stay put and let `restingProcessTick` heal in place, instead of trekking back to the kingdom.
  if (clauses.some(isClauseBlockedOnlyByHealth)) {
    setActiveClause(undefined);
    return;
  }

  returnToKingdomFallback();
}

// Where the party is currently headed for the active clause - not just idle-vs-not, so it can be compared against a freshly re-picked clause's target below.
function activeDestinationNodeName(): string | undefined {
  const world = gamestate().world;
  if (world.gathering.status === 'Gathering') return world.gathering.nodeName;
  if (world.travel.status === 'Traveling')
    return world.travel.destinationNodeName;
  return undefined;
}

// `decreeClauseUpdate` edits a clause in place (same id, e.g. swapping a GatherMaterial's material), so comparing by id would miss it - compare the node the clause actually sends the party to instead.
function clauseDispatchTarget(clause: DecreeClause): string | undefined {
  if (clause.type === 'ReturnToKingdom') {
    return worldNodesOfType('Kingdom')[0]?.nodeName;
  }
  return clauseTargetNode(clause)?.nodeName;
}

// Reference, not deep-equal - `decreeClauses()` only gets a new array on an actual edit (see decree.ts), so this skips pickNextClause's pathfinding on the (vast majority of) ticks where nothing changed.
let lastCheckedDecreeClauses: DecreeClause[] | undefined;

// Editing the decree should preempt an in-progress clause, not wait for it to finish; combat can't be redirected mid-fight.
function interruptForPriorityChange(): boolean {
  if (currentCombat()) return false;

  const autoMode = gamestate().world.autoMode;
  if (!autoMode.activeClauseId) return false;

  const currentTarget = activeDestinationNodeName();
  if (!currentTarget) return false;

  const clauses = decreeClauses();
  if (clauses === lastCheckedDecreeClauses) return false;
  lastCheckedDecreeClauses = clauses;

  const nextClause = pickNextClause(clauses);
  if (!nextClause) return false;

  // `decreeClauseUpdate` edits in place (same id), so a same-id clause can still need a full
  // redispatch - only treat it as truly unchanged when the target matches too.
  const nextTarget = clauseDispatchTarget(nextClause);
  if (
    nextClause.id === autoMode.activeClauseId &&
    nextTarget === currentTarget
  ) {
    return false;
  }

  // Same node either way (e.g. two clauses sharing a multi-material GatherNode) - hand the "active"
  // role to the real top-priority clause, so quantity/failure tracking follows it, without
  // restarting an already-correct gather/travel.
  if (nextTarget === currentTarget) {
    setActiveClause(nextClause.id);
    return false;
  }

  if (isGathering()) gatheringStop();
  runClause(nextClause);
  return true;
}

export function autoModeProcessTick(): void {
  const enabled = autoModeIsEnabled();
  syncAutoModeGlobalEffect(enabled);
  if (!enabled) return;

  adoptInProgressGatherClause();
  stopGatherIfTargetReached();
  if (stopOrphanedGather()) return;
  if (interruptForPriorityChange()) return;
  if (!isPartyIdleForAutoMode()) return;

  advanceToNextClause();
}
