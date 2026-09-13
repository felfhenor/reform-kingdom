import { getEntry } from '@helpers/content/content';
import { getMaterialQuantity } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { rngNumberRange } from '@helpers/rng';
import { townReputationTierValueResolve } from '@helpers/town/reputation/town-reputation-tier-value';
import type {
  CommissionOfferContent,
  CommissionOfferSlot,
  CommissionRequirement,
  CommissionRequirementEntry,
  EligibleCommissionOffer,
  EquipmentContent,
  GameState,
  ItemContent,
  MonsterContent,
  TownId,
} from '@interfaces';

// Shared by caravan and town commission generation - both draw from the same weighted CommissionOfferSlot[] pool shape.
export function eligibleCommissionOffers(
  slots: CommissionOfferSlot[],
): EligibleCommissionOffer[] {
  return slots
    .map((slot) => {
      const offer = getEntry<CommissionOfferContent>(slot.commissionOfferId);
      return offer ? { offer, weight: slot.weight } : undefined;
    })
    .filter((slot): slot is EligibleCommissionOffer => !!slot);
}

function commissionOfferTierMultiplier(
  offer: CommissionOfferContent,
  townId?: TownId,
): number {
  if (!townId || offer.reputationTierMultipliers.length === 0) return 1;

  // Falls back to 1, not the resolver's own 0-if-unmatched, so an offer that forgets to author tier 0 doesn't become free.
  return (
    townReputationTierValueResolve(townId, offer.reputationTierMultipliers) || 1
  );
}

export function commissionOfferReputationReward(
  offer: CommissionOfferContent,
  townId?: TownId,
): number {
  return Math.round(
    offer.townReputationReward * commissionOfferTierMultiplier(offer, townId),
  );
}

export function rollCommissionRequirements(
  offer: CommissionOfferContent,
  townId?: TownId,
): CommissionRequirement[] {
  const multiplier = commissionOfferTierMultiplier(offer, townId);

  return offer.requirements.map((requirement) => {
    const quantity = Math.round(
      rngNumberRange(requirement.quantityMin, requirement.quantityMax) *
        multiplier,
    );

    if ('equipmentId' in requirement) {
      return { equipmentId: requirement.equipmentId, quantity };
    }
    if ('monsterId' in requirement) {
      return { monsterId: requirement.monsterId, quantity, progress: 0 };
    }
    return { itemId: requirement.itemId, quantity };
  });
}

// Reads off an explicit `state` when given, so callers can re-validate against a commit-time state.
export function commissionRequirementOwnedQuantity(
  requirement: CommissionRequirement,
  state?: GameState,
): number {
  if ('equipmentId' in requirement) {
    const armory = state ? state.armory : armoryGet();
    return armory.filter((item) => item.equipmentId === requirement.equipmentId)
      .length;
  }

  // A kill requirement's progress is tallied on the requirement itself, not read from inventory.
  if ('monsterId' in requirement) return requirement.progress;

  return state
    ? (state.materials[requirement.itemId]?.quantity ?? 0)
    : getMaterialQuantity(requirement.itemId);
}

export function commissionRequirementsSatisfied(
  requirements: CommissionRequirement[],
  state?: GameState,
): boolean {
  return requirements.every(
    (requirement) =>
      commissionRequirementOwnedQuantity(requirement, state) >=
      requirement.quantity,
  );
}

// Every UI surface reuses the same icon-row rendering the tradeskill panel already uses for recipe requirements.
export function buildCommissionRequirementEntries(
  requirements: CommissionRequirement[],
): CommissionRequirementEntry[] {
  return requirements.map((requirement) => {
    if ('equipmentId' in requirement) {
      return {
        kind: 'equipment',
        content: getEntry<EquipmentContent>(requirement.equipmentId),
        spritesheet: 'equipment',
        quantity: requirement.quantity,
        owned: commissionRequirementOwnedQuantity(requirement),
      };
    }

    if ('monsterId' in requirement) {
      return {
        kind: 'monster',
        content: getEntry<MonsterContent>(requirement.monsterId),
        spritesheet: 'monster',
        quantity: requirement.quantity,
        owned: commissionRequirementOwnedQuantity(requirement),
      };
    }

    return {
      kind: 'item',
      content: getEntry<ItemContent>(requirement.itemId),
      spritesheet: 'item',
      quantity: requirement.quantity,
      owned: commissionRequirementOwnedQuantity(requirement),
    };
  });
}
