import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionOfferRequirement,
  CommissionOfferRequirementEquipment,
  CommissionOfferRequirementItem,
  ItemId,
} from '../../interfaces';

function ensureCommissionOfferRequirement(
  requirement: Partial<CommissionOfferRequirementItem> &
    Partial<CommissionOfferRequirementEquipment> = {},
): CommissionOfferRequirement {
  if (requirement.equipmentId) {
    return {
      equipmentId: requirement.equipmentId,
      quantityMin: requirement.quantityMin ?? 1,
      quantityMax: requirement.quantityMax ?? 1,
    };
  }

  return {
    itemId: requirement.itemId ?? ('UNKNOWN' as ItemId),
    quantityMin: requirement.quantityMin ?? 1,
    quantityMax: requirement.quantityMax ?? 1,
  };
}

export function ensureCommissionOffer(
  offer: Partial<CommissionOfferContent>,
): Required<CommissionOfferContent> {
  return {
    id: offer.id ?? ('UNKNOWN' as CommissionOfferId),
    name: offer.name ?? 'UNKNOWN',
    __type: 'commissionoffer',
    description: offer.description ?? 'UNKNOWN',
    requirements: ensureArray(
      offer.requirements,
      ensureCommissionOfferRequirement,
    ),
    tokenReward: offer.tokenReward ?? 1,
  };
}
