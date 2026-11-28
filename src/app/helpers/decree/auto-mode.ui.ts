import { contentNameById, nodeNameText } from '@helpers/i18n/i18n-content';
import { enumLabel, t } from '@helpers/i18n/i18n';
import {
  decreeWaitForFullEnergyBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { isPartyAtFullEnergy, isPartyAtFullHealth } from '@helpers/hero/party';
import { getMaterialQuantity } from '@helpers/item/materials';
import { worldAutoModeState } from '@helpers/state-game';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type { DecreeClause } from '@interfaces';

function clauseStatusLabel(clause: DecreeClause): string {
  switch (clause.type) {
    case 'GatherMaterial':
      return t('autoMode.gathering', {
        item: contentNameById(clause.materialId) ?? t('decree.someMaterials'),
        current: getMaterialQuantity(clause.materialId).toLocaleString(),
        target: clause.targetQuantity.toLocaleString(),
      });
    case 'FarmNode':
      return t('autoMode.farmingFor', {
        node: nodeNameText(clause.nodeName),
        reward:
          rewardContentInfo(clause.reward)?.name ?? t('decree.someReward'),
        current: farmNodeRewardQuantity(clause.reward).toLocaleString(),
        target: clause.targetQuantity.toLocaleString(),
      });
    case 'FinishUnfinishedAreas':
      return t('autoMode.seekingAreas');
    case 'LevelUpParty':
      return t('autoMode.levelingUp', {
        risk: enumLabel('riskLevel', clause.riskTolerance),
      });
    case 'ReturnToKingdom':
      return t('autoMode.returningHome');
    case 'DefendTowns':
      return clause.townName
        ? t('autoMode.defending', {
            town: contentNameById(clause.townName) ?? clause.townName,
          })
        : t('autoMode.seekingTown');
    case 'AutoFarmNode':
      return t('autoMode.farming', { node: nodeNameText(clause.nodeName) });
  }
}

export function autoModeStatusLabel(): string | undefined {
  const autoMode = worldAutoModeState();
  if (!autoMode.enabled) return undefined;

  const clause = autoMode.clauses.find(
    (candidate) => candidate.id === autoMode.activeClauseId,
  );
  if (clause) return clauseStatusLabel(clause);

  if (decreeWaitForFullHealthBeforeCombat() && !isPartyAtFullHealth()) {
    return t('autoMode.healing');
  }

  if (decreeWaitForFullEnergyBeforeCombat() && !isPartyAtFullEnergy()) {
    return t('autoMode.energizing');
  }

  return t('autoMode.idle');
}
