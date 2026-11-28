import { enumLabel, t } from '@helpers/i18n/i18n';
import { contentNameById, nodeNameText } from '@helpers/i18n/i18n-content';
import { decreeClauseConflicts, decreeClauses } from '@helpers/decree/decree';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { updateGamestate, worldAutoModeState } from '@helpers/state-game';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
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
  const quantity = 'targetQuantity' in clause ? clause.targetQuantity : 0;
  const risk =
    'riskTolerance' in clause
      ? enumLabel('riskLevel', clause.riskTolerance)
      : '';
  const node =
    'nodeName' in clause && clause.nodeName
      ? nodeNameText(clause.nodeName)
      : '';
  switch (clause.type) {
    case 'GatherMaterial': {
      const item =
        contentNameById(clause.materialId) ?? t('decree.someMaterials');
      const params = { item, node, quantity: quantity.toLocaleString() };
      return clause.nodeName
        ? t('decree.gatherFrom', params)
        : t('decree.gather', params);
    }
    case 'FarmNode':
      return t('decree.farmUntil', {
        node,
        quantity: quantity.toLocaleString(),
        reward:
          rewardContentInfo(clause.reward)?.name ?? t('decree.someReward'),
      });
    case 'FinishUnfinishedAreas':
      return t('decree.finishAreas', { risk });
    case 'LevelUpParty':
      return t('decree.levelUp', { risk });
    case 'ReturnToKingdom':
      return t('decree.returnHome');
    case 'DefendTowns':
      return clause.townName
        ? t('decree.defendTown', {
            town: contentNameById(clause.townName) ?? clause.townName,
            risk,
          })
        : t('decree.defendTowns', { risk });
    case 'AutoFarmNode':
      return t('decree.autoFarm', { node });
  }
}
