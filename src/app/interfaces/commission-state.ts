import type { CaravanId } from '@interfaces/content-caravan';
import type { CommissionOfferId } from '@interfaces/content-commission-offer';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { MonsterContent, MonsterId } from '@interfaces/content-monster';
import type { CraftRequirementEntry } from '@interfaces/crafting';
import type { DroppedReward } from '@interfaces/droppable';

// Rolled from a CommissionOfferRequirement's quantityMin/quantityMax at generation time.
export type CommissionRequirementItem = { itemId: ItemId; quantity: number };
export type CommissionRequirementEquipment = {
  equipmentId: EquipmentId;
  quantity: number;
};
// Progress is tallied here directly (not derived from inventory like item/equipment) since a kill leaves nothing to own.
export type CommissionRequirementMonsterKill = {
  monsterId: MonsterId;
  quantity: number;
  progress: number;
};
export type CommissionRequirement =
  | CommissionRequirementItem
  | CommissionRequirementEquipment
  | CommissionRequirementMonsterKill;

// CraftRequirementEntry plus a monster-kill variant - kept separate since recipes never have kill requirements.
export type CommissionRequirementEntry =
  | CraftRequirementEntry
  | {
      kind: 'monster';
      content?: MonsterContent;
      spritesheet: 'monster';
      quantity: number;
      owned: number;
    };

export type CommissionNodeState = {
  commissionOfferId?: CommissionOfferId;
  requirements: CommissionRequirement[];
  completed: boolean;
  // Date.now() epoch ms - wall-clock, not a tick count. See commission-reset.ts.
  generatedAt: number;
};

export type GameStateCommissions = {
  [key: CaravanId]: CommissionNodeState;
};

// Resolved for display - built once by helpers, rendered identically by
// both the Commissions panel and a caravan's trade modal turn-in section.
export type CommissionRowViewModel = {
  caravanId: CaravanId;
  nodeName: string;
  caravanName: string;
  requirementEntries: CommissionRequirementEntry[];
  rewards: DroppedReward[];
  canFulfill: boolean;
  completed: boolean;
  isPartyHere: boolean;
  canTravel: boolean;
  // Set only while actively traveling toward this caravan's node.
  travelEtaSeconds?: number;
};
