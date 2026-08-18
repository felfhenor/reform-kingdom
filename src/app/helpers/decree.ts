import { analyticsSendDesignEvent } from '@helpers/analytics';
import { getEntry } from '@helpers/content';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { rewardContentInfo, rewardKey } from '@helpers/world-node-rewards';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  DecreeRiskLevel,
  ItemContent,
} from '@interfaces';

export function decreeClauses(): DecreeClause[] {
  return gamestate().world.autoMode.clauses;
}

export function decreeRiskTolerance(): DecreeRiskLevel {
  return gamestate().world.autoMode.riskTolerance;
}

export function decreeWaitForFullHealthBeforeCombat(): boolean {
  return gamestate().world.autoMode.waitForFullHealthBeforeCombat;
}

// A node's current losing streak, keyed by `WorldNodeEntry.nodeName` - see
// `AutoModeState.nodeFailureCounts` for who reads/writes this.
export function decreeNodeFailureCount(nodeName: string): number {
  return gamestate().world.autoMode.nodeFailureCounts[nodeName] ?? 0;
}

export function decreeSetWaitForFullHealthBeforeCombat(value: boolean): void {
  updateGamestate((state) => {
    state.world.autoMode.waitForFullHealthBeforeCombat = value;
    return state;
  });
}

// Two clauses conflict if they target the same thing regardless of quantity (e.g. a lower "gather until 20" is dead weight behind a "gather until 100").
export function decreeClauseConflicts(
  action: DecreeClauseAction,
  existing: DecreeClause[],
): boolean {
  return existing.some((clause) => {
    if (clause.type !== action.type) return false;
    if (action.type === 'GatherMaterial' && clause.type === 'GatherMaterial') {
      return clause.materialId === action.materialId;
    }
    if (action.type === 'FarmNode' && clause.type === 'FarmNode') {
      return (
        clause.nodeName === action.nodeName &&
        rewardKey(clause.reward) === rewardKey(action.reward)
      );
    }
    return true;
  });
}

// Refuses to add a clause that duplicates one already on the list (see
// `decreeClauseConflicts`). Returns whether the clause was actually added.
export function decreeClauseAdd(action: DecreeClauseAction): boolean {
  if (decreeClauseConflicts(action, decreeClauses())) return false;

  const clause: DecreeClause = {
    ...action,
    id: rngUuid() as DecreeClauseId,
    enabled: true,
    failureCount: 0,
  };

  updateGamestate((state) => {
    state.world.autoMode.clauses = [clause, ...state.world.autoMode.clauses];
    return state;
  });

  analyticsSendDesignEvent('Decree:Clause:Add');
  return true;
}

// Rebuilds the clause fresh from `action` (not spread) so a dropped field can't linger from the old clause.
export function decreeClauseUpdate(
  clauseId: DecreeClauseId,
  action: DecreeClauseAction,
): boolean {
  const clauses = decreeClauses();
  const existing = clauses.find((clause) => clause.id === clauseId);
  if (!existing) return false;

  const otherClauses = clauses.filter((clause) => clause.id !== clauseId);
  if (decreeClauseConflicts(action, otherClauses)) return false;

  updateGamestate((state) => {
    state.world.autoMode.clauses = state.world.autoMode.clauses.map((clause) =>
      clause.id === clauseId
        ? {
            ...action,
            id: clause.id,
            enabled: clause.enabled,
            failureCount: clause.failureCount,
          }
        : clause,
    );
    return state;
  });

  return true;
}

export function decreeClauseRemove(clauseId: DecreeClauseId): void {
  let didRemove = false;

  updateGamestate((state) => {
    const existedBefore = state.world.autoMode.clauses.some(
      (clause) => clause.id === clauseId,
    );
    if (!existedBefore) return state;
    didRemove = true;

    state.world.autoMode.clauses = state.world.autoMode.clauses.filter(
      (clause) => clause.id !== clauseId,
    );
    if (state.world.autoMode.activeClauseId === clauseId) {
      state.world.autoMode.activeClauseId = undefined;
    }
    return state;
  });

  if (didRemove) analyticsSendDesignEvent('Decree:Clause:Remove');
}

export function decreeClauseSetEnabled(
  clauseId: DecreeClauseId,
  enabled: boolean,
): void {
  updateGamestate((state) => {
    state.world.autoMode.clauses = state.world.autoMode.clauses.map((clause) =>
      clause.id === clauseId ? { ...clause, enabled } : clause,
    );
    return state;
  });
}

// Rebuilds the clause list in a new order - the priority list is a simple
// reorderable array, no separate priority field to keep in sync.
export function decreeClauseReorder(
  previousIndex: number,
  newIndex: number,
): void {
  updateGamestate((state) => {
    const clauses = [...state.world.autoMode.clauses];
    const [moved] = clauses.splice(previousIndex, 1);
    if (!moved) return state;

    clauses.splice(newIndex, 0, moved);
    state.world.autoMode.clauses = clauses;
    return state;
  });
}

export function decreeSetRiskTolerance(riskTolerance: DecreeRiskLevel): void {
  updateGamestate((state) => {
    state.world.autoMode.riskTolerance = riskTolerance;
    return state;
  });

  analyticsSendDesignEvent('Decree:Risk:Change');
}

// Static description of what a clause does; distinct from auto-mode.ts's autoModeStatusLabel, which shows live progress.
export function decreeClauseSummary(clause: DecreeClause): string {
  switch (clause.type) {
    case 'GatherMaterial': {
      const item = getEntry<ItemContent>(clause.materialId);
      return `Gather ${item?.name ?? 'materials'} until ${clause.targetQuantity.toLocaleString()} in storage`;
    }
    case 'FarmNode': {
      const reward = rewardContentInfo(clause.reward);
      return `Farm ${clause.nodeName} until ${clause.targetQuantity.toLocaleString()}x ${reward?.name ?? 'reward'} obtained`;
    }
    case 'FinishUnfinishedAreas':
      return 'Finish unfinished areas';
    case 'LevelUpParty':
      return 'Level up the party';
    case 'ReturnToKingdom':
      return 'Return to the kingdom';
  }
}
