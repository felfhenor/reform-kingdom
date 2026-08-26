import { isPartyAtCaravan } from '@helpers/caravan/caravan';
import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import {
  applyMaterialDelta,
  getMaterialQuantity,
  traderTokenId,
} from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanId,
  CommissionNodeState,
  CommissionOfferContent,
  CommissionRequirement,
  CommissionRequirementEquipment,
  CommissionRowViewModel,
  CraftRequirementEntry,
  EquipmentContent,
  EquipmentItem,
  GameState,
  ItemContent,
  WorldNodeEntry,
} from '@interfaces';

function commissionState(
  caravanId: CaravanId,
  state: GameState = gamestate(),
): CommissionNodeState | undefined {
  return state.world.commissions[caravanId];
}

// Reads off an explicit `state` when given, so this can be re-validated
// against a commit-time state instead of the possibly-stale live gamestate().
function ownedQuantity(
  requirement: CommissionRequirement,
  state?: GameState,
): number {
  if ('equipmentId' in requirement) {
    const armory = state ? state.armory : armoryGet();
    return armory.filter((item) => item.equipmentId === requirement.equipmentId)
      .length;
  }

  return state
    ? (state.materials[requirement.itemId]?.quantity ?? 0)
    : getMaterialQuantity(requirement.itemId);
}

// Shaped like CraftRequirementEntry so both UI surfaces (the Commissions
// panel and a caravan's trade modal) can reuse the same icon-row rendering
// the tradeskill panel already uses for recipe requirements.
export function commissionRequirementEntries(
  caravanId: CaravanId,
): CraftRequirementEntry[] {
  const state = commissionState(caravanId);
  if (!state) return [];

  return state.requirements.map((requirement) =>
    'equipmentId' in requirement
      ? {
          kind: 'equipment',
          content: getEntry<EquipmentContent>(requirement.equipmentId),
          spritesheet: 'equipment',
          quantity: requirement.quantity,
          owned: ownedQuantity(requirement),
        }
      : {
          kind: 'item',
          content: getEntry<ItemContent>(requirement.itemId),
          spritesheet: 'item',
          quantity: requirement.quantity,
          owned: ownedQuantity(requirement),
        },
  );
}

// False until the first `commissionProcessTick` has generated this
// caravan's commission - lets the UI skip rendering an empty row.
export function commissionExists(caravanId: CaravanId): boolean {
  return !!commissionState(caravanId)?.commissionOfferId;
}

export function commissionTokenReward(caravanId: CaravanId): number {
  const state = commissionState(caravanId);
  const offer = state?.commissionOfferId
    ? getEntry<CommissionOfferContent>(state.commissionOfferId)
    : undefined;

  return offer?.tokenReward ?? 0;
}

// Accepts an explicit `state` to re-validate at commit time (see `ownedQuantity`).
export function commissionCanFulfill(
  caravanId: CaravanId,
  state?: GameState,
): boolean {
  const nodeState = commissionState(caravanId, state);
  if (!nodeState || nodeState.completed || !nodeState.commissionOfferId) {
    return false;
  }

  return nodeState.requirements.every(
    (requirement) => ownedQuantity(requirement, state) >= requirement.quantity,
  );
}

// Built once here so the Commissions panel and a caravan's trade modal
// turn-in section render identically without duplicating this composition.
export function commissionRowViewModel(
  entry: WorldNodeEntry,
): CommissionRowViewModel | undefined {
  const caravan = worldNodeCaravan(entry);
  if (!caravan || !commissionExists(caravan.id)) return undefined;

  return {
    caravanId: caravan.id,
    nodeName: entry.nodeName,
    caravanName: caravan.name,
    requirementEntries: commissionRequirementEntries(caravan.id),
    tokenReward: commissionTokenReward(caravan.id),
    canFulfill: commissionCanFulfill(caravan.id),
    completed: !!commissionState(caravan.id)?.completed,
    isPartyHere: isPartyAtCaravan(caravan.id),
    canTravel: canPartyTravel(),
    travelEtaSeconds: travelEtaSecondsTo(entry.nodeName),
  };
}

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

// Fast path only - commissionCanFulfill is repeated against live state
// inside the callback, since updateGamestate commits asynchronously.
export async function commissionFulfill(
  caravanId: CaravanId,
): Promise<boolean> {
  if (!commissionCanFulfill(caravanId) || !isPartyAtCaravan(caravanId)) {
    return false;
  }

  let fulfilled = false;

  await updateGamestate((s) => {
    if (!commissionCanFulfill(caravanId, s)) return s;

    const nodeState = s.world.commissions[caravanId];
    if (!nodeState?.commissionOfferId) return s;

    const offer = getEntry<CommissionOfferContent>(nodeState.commissionOfferId);
    const tokenReward = offer?.tokenReward ?? 0;

    nodeState.requirements.forEach((requirement) => {
      if ('equipmentId' in requirement) {
        s.armory = consumeEquipmentRequirement(s.armory, requirement);
        return;
      }

      applyMaterialDelta(s, requirement.itemId, -requirement.quantity);
    });
    applyMaterialDelta(s, traderTokenId(), tokenReward);
    nodeState.completed = true;
    fulfilled = true;

    return s;
  });

  if (fulfilled) analyticsSendDesignEvent('Kingdom:Commission:Fulfill');
  return fulfilled;
}
