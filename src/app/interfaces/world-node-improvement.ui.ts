import type { CostItem } from '@interfaces/cost';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

export type WorldNodeImprovementRowViewModel = {
  node: WorldNodeEntry;
  regionName: string;
  level: number;
  costs: CostItem[];
  // Set only while the next level is being developed.
  developingTimerText?: string;
  isPartyHere: boolean;
  canTravel: boolean;
  // Set only while actively traveling toward this node.
  travelEtaSeconds?: number;
};
