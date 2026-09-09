import { getEntry } from '@helpers/content/content';
import {
  decreeWaitForFullEnergyBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { isPartyAtFullEnergy, isPartyAtFullHealth } from '@helpers/hero/party';
import { getMaterialQuantity } from '@helpers/item/materials';
import { gamestate } from '@helpers/state-game';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import type { DecreeClause, ItemContent } from '@interfaces';

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
      return 'Returning home...';
    case 'DefendTowns':
      return clause.townName
        ? `Defending ${clause.townName}...`
        : 'Seeking a town to defend...';
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

  if (decreeWaitForFullEnergyBeforeCombat() && !isPartyAtFullEnergy()) {
    return 'Energizing before the next move...';
  }

  return 'Idle';
}
