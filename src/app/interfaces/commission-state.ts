import type { CaravanId } from '@interfaces/content-caravan';
import type {
  CommissionOfferContent,
  CommissionOfferId,
} from '@interfaces/content-commission-offer';
import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { MonsterContent, MonsterId } from '@interfaces/content-monster';
import type { TownId } from '@interfaces/content-town';
import type { CraftRequirementEntry } from '@interfaces/crafting';
import type { DroppedReward } from '@interfaces/droppable';
import type { TownCommissionSlotId } from '@interfaces/town-state';

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
  // Date.now() epoch ms - wall-clock, not a tick count.
  generatedAt: number;
};

export type GameStateCommissions = {
  [key: CaravanId]: CommissionNodeState;
};

// Shared by caravan and town commission generation.
export type EligibleCommissionOffer = {
  offer: CommissionOfferContent;
  weight: number;
};

// Resolved for display - rendered identically whether the row came from a caravan or a town.
export type CommissionSlotDisplay = {
  nodeName: string;
  title: string;
  requirementEntries: CommissionRequirementEntry[];
  rewards: DroppedReward[];
  canFulfill: boolean;
  // Always false for a town row - a fulfilled town slot is removed outright, never flagged.
  completed: boolean;
  isPartyHere: boolean;
  canTravel: boolean;
  // Set only while actively traveling toward this row's node.
  travelEtaSeconds?: number;
  // Town rows only - granted instead of `rewards`, which towns never pay out.
  reputationReward?: number;

  commission?: CommissionOfferContent;
};

export type CommissionRowViewModel = CommissionSlotDisplay & {
  caravanId: CaravanId;
};

export type TownCommissionRowViewModel = CommissionSlotDisplay & {
  townId: TownId;
  slotId: TownCommissionSlotId;
};
