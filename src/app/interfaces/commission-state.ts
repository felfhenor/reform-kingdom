import type { CaravanId } from '@interfaces/content-caravan';
import type { CommissionOfferId } from '@interfaces/content-commission-offer';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { CraftRequirementEntry } from '@interfaces/crafting';

// Rolled from a CommissionOfferRequirement's quantityMin/quantityMax at generation time.
export type CommissionRequirementItem = { itemId: ItemId; quantity: number };
export type CommissionRequirementEquipment = {
  equipmentId: EquipmentId;
  quantity: number;
};
export type CommissionRequirement =
  | CommissionRequirementItem
  | CommissionRequirementEquipment;

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
  requirementEntries: CraftRequirementEntry[];
  tokenReward: number;
  canFulfill: boolean;
  completed: boolean;
  isPartyHere: boolean;
  // Set only while actively traveling toward this caravan's node.
  travelEtaSeconds: number | undefined;
};
