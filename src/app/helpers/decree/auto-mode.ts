import {
  DECREE_PRIORITY_RECHECK_INTERVAL_TICKS,
  ONE_YEAR_TICKS,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  autoModeIsEnabled,
  autoModeSetActiveClause,
} from '@helpers/decree/auto-mode-state';
import {
  decreeClauses,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import {
  clauseTargetNode,
  isClauseSatisfiable,
  pickTopPriorityClause,
} from '@helpers/decree/decree-evaluation';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  addGlobalEffect,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import { isPartyAtFullHealth } from '@helpers/hero/party';
import { travelStart } from '@helpers/hero/travel';
import { gatheringStop, isGathering } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import {
  worldAutoModeState,
  worldGatheringState,
  worldTravelState,
  worldCombatState,
} from '@helpers/state-game';
import { raidEngageCombat } from '@helpers/town/raid/town-raid-combat';
import { homeNodeGet, isPlayerAtHome } from '@helpers/town/town-spawn';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import {
  worldNodeByName,
  worldNodeTown,
} from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  GlobalEffectContent,
  GlobalEffectId,
} from '@interfaces';

function syncAutoModeGlobalEffect(enabled: boolean): void {
  const isEffectActive = isGlobalEffectActive('Auto Mode' as GlobalEffectId);
  if (enabled === isEffectActive) return;

  if (enabled) {
    addGlobalEffect('Auto Mode' as GlobalEffectId, ONE_YEAR_TICKS);
    return;
  }

  const content = getEntry<GlobalEffectContent>('Auto Mode' as GlobalEffectId);
  if (content) removeGlobalEffect(content.id);
}

// Adopts any in-progress gather matching an enabled GatherMaterial clause so the stop-check always has a clause to work with.
function adoptInProgressGatherClause(): void {
  const autoMode = worldAutoModeState();
  if (autoMode.activeClauseId) return;

  const gathering = worldGatheringState();
  if (gathering.status !== 'Gathering' || !gathering.nodeName) return;

  const node = worldNodeByName(gathering.nodeName);
  if (!node) return;

  const nodeMaterialIds = worldNodeGatherMaterialIds(node);
  const matchingClause = autoMode.clauses.find(
    (clause) =>
      clause.enabled &&
      clause.type === 'GatherMaterial' &&
      nodeMaterialIds.includes(clause.materialId) &&
      (!clause.nodeName || clause.nodeName === gathering.nodeName),
  );
  if (!matchingClause) return;

  autoModeSetActiveClause(matchingClause.id);
}

// Gathering loops forever on its own; this ends it once the target is reached and hands control back to clause re-evaluation.
function stopGatherIfTargetReached(): void {
  const autoMode = worldAutoModeState();
  if (!autoMode.activeClauseId) return;
  if (worldGatheringState().status !== 'Gathering') return;

  const clause = autoMode.clauses.find(
    (candidate) => candidate.id === autoMode.activeClauseId,
  );
  if (!clause || clause.type !== 'GatherMaterial') return;
  if (getMaterialQuantity(clause.materialId) < clause.targetQuantity) return;

  gatheringStop();
  autoModeSetActiveClause(undefined);
}

function isPartyIdleForAutoMode(): boolean {
  return (
    worldTravelState().status === 'Idle' &&
    !isGathering() &&
    !worldCombatState()
  );
}

// An orphaned gather (no clause tracking it, e.g. started manually or its clause got disabled) never stops on its own, leaving Auto Mode stuck at that node. Ends it so per-tick evaluation resumes.
function stopOrphanedGather(): boolean {
  const autoMode = worldAutoModeState();
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
  autoModeSetActiveClause(clause.id);

  if (clause.type === 'ReturnToKingdom') {
    const home = homeNodeGet();
    if (home) travelStart(home.nodeName, true);
    return;
  }

  const target = clauseTargetNode(clause);
  if (target) travelStart(target.nodeName, true);
}

// Parks at home when no clause is satisfiable, rather than leaving the party stuck. Not tracked as an active clause, so it never accrues failures.
function returnToKingdomFallback(): void {
  autoModeSetActiveClause(undefined);
  if (isPlayerAtHome()) return;

  const home = homeNodeGet();
  if (home) travelStart(home.nodeName, true);
}

function advanceToNextClause(): void {
  const clause = pickTopPriorityClause(decreeClauses());
  if (!clause) {
    returnToKingdomFallback();
    return;
  }

  // Blocked only by the health gate - stay put and heal in place, instead of trekking back home.
  if (!isClauseSatisfiable(clause)) {
    autoModeSetActiveClause(undefined);
    return;
  }

  runClause(clause);
}

// Where the party is currently headed for the active clause - not just idle-vs-not, so it can be compared against a freshly re-picked clause's target below.
function activeDestinationNodeName(): string | undefined {
  const gathering = worldGatheringState();
  if (gathering.status === 'Gathering') return gathering.nodeName;

  const travel = worldTravelState();
  if (travel.status === 'Traveling') return travel.destinationNodeName;
  return undefined;
}

function clauseDispatchTarget(clause: DecreeClause): string | undefined {
  if (clause.type === 'ReturnToKingdom') {
    return homeNodeGet()?.nodeName;
  }
  return clauseTargetNode(clause)?.nodeName;
}

let lastCheckedDecreeClauses: DecreeClause[] | undefined;

// Gathering doesn't regen, so a gather can never outlast a higher clause's health gate - stop it so the party rests instead.
function pauseGatherToHeal(): boolean {
  if (!isGathering()) return false;

  gatheringStop();
  autoModeSetActiveClause(undefined);
  return true;
}

// Travel re-resolves on arrival anyway, and rechecking mid-travel would miss the path cache on every step.
function isPeriodicRecheckDue(): boolean {
  return (
    isGathering() &&
    timerTicksElapsed() % DECREE_PRIORITY_RECHECK_INTERVAL_TICKS === 0
  );
}

// Preempts an in-progress clause on a decree edit, or when a higher-priority clause becomes actionable mid-gather; combat can't be redirected mid-fight.
function interruptForPriorityChange(): boolean {
  if (worldCombatState()) return false;

  const autoMode = worldAutoModeState();
  if (!autoMode.activeClauseId) return false;

  const currentTarget = activeDestinationNodeName();
  if (!currentTarget) return false;

  const clauses = decreeClauses();
  const decreeEdited = clauses !== lastCheckedDecreeClauses;
  if (!decreeEdited && !isPeriodicRecheckDue()) return false;
  lastCheckedDecreeClauses = clauses;

  const nextClause = pickTopPriorityClause(clauses);
  if (!nextClause) return false;

  // Without an edit, only a higher clause counts - not the active clause's own target drifting as the party moves.
  if (!decreeEdited && nextClause.id === autoMode.activeClauseId) return false;

  return redirectToClause(nextClause, currentTarget);
}

function redirectToClause(
  nextClause: DecreeClause,
  currentTarget: string,
): boolean {
  const activeClauseId = worldAutoModeState().activeClauseId;
  if (!isClauseSatisfiable(nextClause)) {
    return nextClause.id !== activeClauseId && pauseGatherToHeal();
  }

  const nextTarget = clauseDispatchTarget(nextClause);
  if (nextClause.id === activeClauseId && nextTarget === currentTarget) {
    return false;
  }

  // Same node either way (e.g. two clauses sharing a multi-material GatherNode) - hand the "active"
  // role to the real top-priority clause, so quantity/failure tracking follows it, without
  // restarting an already-correct gather/travel.
  if (nextTarget === currentTarget) {
    autoModeSetActiveClause(nextClause.id);
    return false;
  }

  if (isGathering()) gatheringStop();
  runClause(nextClause);
  return true;
}

// Unlike every other clause, arriving at a DefendTowns target means "engage", not "done".
function attemptDefendTownsEngage(): boolean {
  const autoMode = worldAutoModeState();
  const clause = autoMode.clauses.find(
    (candidate) => candidate.id === autoMode.activeClauseId,
  );
  if (!clause || clause.type !== 'DefendTowns') return false;

  const target = clauseTargetNode(clause);
  if (!target) return false;

  const entry = worldNodeAtCurrentLocation();
  if (!entry || entry.nodeName !== target.nodeName) return false;

  const town = worldNodeTown(entry);
  if (!town) return false;

  return raidEngageCombat(town.id);
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
  if (attemptDefendTownsEngage()) return;

  advanceToNextClause();
}
