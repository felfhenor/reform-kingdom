import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { rewardKey } from '@helpers/world-node/world-node-rewards';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  DecreeRiskLevel,
  MaterialId,
} from '@interfaces';

export function decreeClauses(): DecreeClause[] {
  return gamestate().world.autoMode.clauses;
}

// Drops clauses whose material no GatherNode produces anymore (post-rebalance) - unlike an
// undiscovered/unreachable node, exploring more can never fix this, so it's safe to prune.
export function pruneInvalidDecreeGatherClauses(
  clauses: DecreeClause[],
  gatherableMaterialIds: MaterialId[],
): DecreeClause[] {
  const gatherable = new Set(gatherableMaterialIds);

  return clauses.filter(
    (clause) =>
      clause.type !== 'GatherMaterial' || gatherable.has(clause.materialId),
  );
}

export function decreeWaitForFullHealthBeforeCombat(): boolean {
  return gamestate().world.autoMode.waitForFullHealthBeforeCombat;
}

export function decreeWaitForFullEnergyBeforeCombat(): boolean {
  return gamestate().world.autoMode.waitForFullEnergyBeforeCombat;
}

export function decreeNodeFailureCount(nodeName: string): number {
  return gamestate().world.autoMode.nodeFailureCounts[nodeName] ?? 0;
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
    if (action.type === 'DefendTowns' && clause.type === 'DefendTowns') {
      return clause.townName === action.townName;
    }
    return true;
  });
}

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

// Pre-per-clause-risk saves stored one global risk tolerance for both risk-aware clause types; backfill it onto any
// clause that predates the split (merge can't do this - it has no per-clause field to copy the legacy value into).
export function backfillDecreeClauseRiskTolerance(
  clauses: DecreeClause[],
  legacyRiskTolerance: DecreeRiskLevel,
): DecreeClause[] {
  return clauses.map((clause) => {
    if (
      clause.type !== 'FinishUnfinishedAreas' &&
      clause.type !== 'LevelUpParty'
    ) {
      return clause;
    }
    if (clause.riskTolerance) return clause;

    return { ...clause, riskTolerance: legacyRiskTolerance };
  });
}
