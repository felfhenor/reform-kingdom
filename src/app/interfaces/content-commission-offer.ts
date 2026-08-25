import type { EquipmentId } from '@interfaces/content-equipment';
import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type CommissionOfferId = Branded<string, 'CommissionOfferId'>;

export type CommissionOfferRequirementItem = {
  itemId: ItemId;
  quantityMin: number;
  quantityMax: number;
};

export type CommissionOfferRequirementEquipment = {
  equipmentId: EquipmentId;
  quantityMin: number;
  quantityMax: number;
};

export type CommissionOfferRequirement =
  | CommissionOfferRequirementItem
  | CommissionOfferRequirementEquipment;

export type CommissionOfferContent = IsContentItem &
  HasDescription & {
    id: CommissionOfferId;
    __type: 'commissionoffer';

    requirements: CommissionOfferRequirement[];

    // Trader Scrips granted on turn-in.
    tokenReward: number;
  };
