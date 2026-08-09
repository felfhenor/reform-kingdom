import type { RewardIdentity } from '@interfaces/droppable';
import type { MaterialId } from '@interfaces/state-game';
import type { Branded } from '@interfaces/identifiable';

export type DecreeClauseId = Branded<string, 'DecreeClauseId'>;

export type DecreeRiskLevel = 'Low' | 'Medium' | 'High';
export type ExploreNodeRiskBand = DecreeRiskLevel | 'TooHigh';

// LevelUpParty has no risk setting of its own - it always targets the
// standing global `AutoModeState.riskTolerance` directly, so there's only
// ever one place risk is configured.
export type DecreeClauseAction =
  | { type: 'GatherMaterial'; materialId: MaterialId; targetQuantity: number }
  | {
      type: 'FarmNode';
      nodeName: string;
      reward: RewardIdentity;
      targetQuantity: number;
    }
  | { type: 'FinishUnfinishedAreas' }
  | { type: 'LevelUpParty' }
  | { type: 'ReturnToKingdom' };

export type DecreeClause = DecreeClauseAction & {
  id: DecreeClauseId;
  enabled: boolean;
  failureCount: number;
};

export type AutoModeState = {
  enabled: boolean;
  clauses: DecreeClause[];
  activeClauseId?: DecreeClauseId;
  riskTolerance: DecreeRiskLevel;
  // When true, FinishUnfinishedAreas/LevelUpParty/FarmNode (the clause types
  // that can lead to a fight) hold off starting a new trip until the party is
  // fully healed - GatherMaterial and ReturnToKingdom never risk combat, so
  // they're unaffected.
  waitForFullHealthBeforeCombat: boolean;
};
