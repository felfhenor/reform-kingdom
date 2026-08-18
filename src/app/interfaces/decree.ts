import type { RewardIdentity } from '@interfaces/droppable';
import type { MaterialId } from '@interfaces/state-game';
import type { Branded } from '@interfaces/identifiable';

export type DecreeClauseId = Branded<string, 'DecreeClauseId'>;

export type DecreeRiskLevel = 'Low' | 'Medium' | 'High';
export type ExploreNodeRiskBand = DecreeRiskLevel | 'TooHigh';

// LevelUpParty has no risk setting of its own; it always uses the global AutoModeState.riskTolerance.
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
  // When true, fight-risking clause types wait for full health before a new trip; GatherMaterial/ReturnToKingdom are unaffected.
  waitForFullHealthBeforeCombat: boolean;
  // Per-node win/loss streak, keyed by nodeName; only LevelUpParty reads it back to steer away from losing nodes.
  nodeFailureCounts: Partial<Record<string, number>>;
};
