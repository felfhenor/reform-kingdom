import { applyResolvedDropToState, rollDroppedRewards } from '@helpers/item/loot';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CommissionOfferContent,
  CommissionRequirement,
  CommissionRequirementEquipment,
  EquipmentItem,
  GameState,
} from '@interfaces';

function consumeEquipmentRequirement(
  armory: EquipmentItem[],
  requirement: CommissionRequirementEquipment,
): EquipmentItem[] {
  let remaining = requirement.quantity;
  return armory.filter((item) => {
    if (item.equipmentId !== requirement.equipmentId || remaining <= 0) {
      return true;
    }
    remaining -= 1;
    return false;
  });
}

// Spends every requirement's cost from the player's own storage/armory - a kill requirement has nothing to spend, its progress already gated eligibility.
export function spendCommissionRequirements(
  state: GameState,
  requirements: CommissionRequirement[],
): void {
  requirements.forEach((requirement) => {
    if ('equipmentId' in requirement) {
      state.armory = consumeEquipmentRequirement(state.armory, requirement);
      return;
    }

    if ('monsterId' in requirement) return;

    applyMaterialDelta(state, requirement.itemId, -requirement.quantity);
  });
}

// Commission rewards aren't level-scaled (no bonusPerLevel is ever authored here), so the level passed to rollDroppedRewards is inert.
export function grantCommissionRewards(
  state: GameState,
  offer: CommissionOfferContent,
): void {
  rollDroppedRewards(offer.rewards, 1).forEach((drop) =>
    applyResolvedDropToState(state, drop),
  );
}
