import { categoryMessageLog } from '@helpers/combat/combat-log';
import {
  applyResolvedDropToState,
  rollDroppedRewards,
} from '@helpers/item/loot';
import { applyMaterialDelta } from '@helpers/item/materials';
import { syncArmoryGlobalEffects } from '@helpers/kingdom/armory-global-effects';
import { worldNodeAtCurrentLocation } from '@helpers/world';
import type {
  AdventureLogRewardPart,
  CommissionOfferContent,
  CommissionRequirement,
  CommissionRequirementEquipment,
  EquipmentItem,
  GameState,
  ResolvedDrop,
} from '@interfaces';
import { compact } from 'es-toolkit/compat';

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

  syncArmoryGlobalEffects(state);
}

// Returns only the drops that landed, so callers can react to them once the callback has committed.
export function grantCommissionRewards(
  state: GameState,
  offer: CommissionOfferContent,
): ResolvedDrop[] {
  return rollDroppedRewards(offer.rewards, 1).filter((drop) =>
    applyResolvedDropToState(state, drop),
  );
}

export function commissionDisplayName(offerName: string): string {
  return offerName.replace('Commission - ', '');
}

// Turn-ins require the party at the caravan/town, so the current node is where it happened.
export function commissionLogTurnIn(
  offerName: string,
  rewards: AdventureLogRewardPart[],
): void {
  if (rewards.length === 0) return;

  categoryMessageLog(
    'Miscellaneous',
    worldNodeAtCurrentLocation()?.nodeName ?? 'Miscellaneous',
    `You got ${rewards.map((reward) => reward.html).join(', ')} from turning in "${commissionDisplayName(offerName)}"!`,
    compact(rewards.map((reward) => reward.icon)),
  );
}
