import { ensureArray } from '@helpers/content/ensure-helpers-core';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionOfferRequirement,
  CommissionOfferRequirementEquipment,
  CommissionOfferRequirementItem,
  CommissionOfferRequirementMonsterKill,
  ItemId,
  RecipeId,
} from '@interfaces';

function ensureCommissionOfferRequirement(
  requirement: Partial<CommissionOfferRequirementItem> &
    Partial<CommissionOfferRequirementEquipment> &
    Partial<CommissionOfferRequirementMonsterKill> = {},
): CommissionOfferRequirement {
  if (requirement.equipmentId) {
    return {
      equipmentId: requirement.equipmentId,
      quantityMin: requirement.quantityMin ?? 1,
      quantityMax: requirement.quantityMax ?? 1,
    };
  }

  if (requirement.monsterId) {
    return {
      monsterId: requirement.monsterId,
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
    rewards: ensureArray(offer.rewards, ensureDroppedReward),
    townReputationReward: offer.townReputationReward ?? 0,
    specialtyForRecipeId:
      offer.specialtyForRecipeId ?? ('UNKNOWN' as RecipeId),
  };
}
