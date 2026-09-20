import { getEntry } from '@helpers/content/content';
import { decreeClauseConflicts, decreeClauses } from '@helpers/decree/decree';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { updateGamestate, worldAutoModeState } from '@helpers/state-game';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  ItemContent,
} from '@interfaces';

export function decreeActiveClauseId(): DecreeClauseId | undefined {
  return worldAutoModeState().activeClauseId;
}

export function decreeSetWaitForFullHealthBeforeCombat(value: boolean): void {
  updateGamestate((state) => {
    state.world.autoMode.waitForFullHealthBeforeCombat = value;
    return state;
  });
}

export function decreeSetWaitForFullEnergyBeforeCombat(value: boolean): void {
  updateGamestate((state) => {
    state.world.autoMode.waitForFullEnergyBeforeCombat = value;
    return state;
  });
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
    const clauses = state.world.autoMode.clauses;
    const index = clauses.findIndex((clause) => clause.id === clauseId);
    if (index === -1) return state;

    const { enabled, failureCount } = clauses[index];
    clauses[index] = { ...action, id: clauseId, enabled, failureCount };
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

export function decreeClauseSummary(clause: DecreeClause): string {
  switch (clause.type) {
    case 'GatherMaterial': {
      const item = getEntry<ItemContent>(clause.materialId);
      const itemName = item?.name ?? 'materials';
      return clause.nodeName
        ? `Gather ${itemName} from ${clause.nodeName} until ${clause.targetQuantity.toLocaleString()} in storage`
        : `Gather ${itemName} until ${clause.targetQuantity.toLocaleString()} in storage`;
    }
    case 'FarmNode': {
      const reward = rewardContentInfo(clause.reward);
      return `Farm ${clause.nodeName} until ${clause.targetQuantity.toLocaleString()}x ${reward?.name ?? 'reward'} obtained`;
    }
    case 'FinishUnfinishedAreas':
      return `Finish unfinished areas (${clause.riskTolerance} risk)`;
    case 'LevelUpParty':
      return `Level up the party (${clause.riskTolerance} risk)`;
    case 'ReturnToKingdom':
      return 'Return home';
    case 'DefendTowns':
      return clause.townName
        ? `Defend ${clause.townName} from raids (${clause.riskTolerance} risk)`
        : `Defend towns from raids (${clause.riskTolerance} risk)`;
  }
}
