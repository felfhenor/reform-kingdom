import { isPartyAtCaravan } from '@helpers/caravan/caravan';
import {
  buildCommissionRequirementEntries,
  commissionRequirementOwnedQuantity,
} from '@helpers/commission/commission-requirement';
import {
  grantCommissionRewards,
  spendCommissionRequirements,
} from '@helpers/commission/commission-turn-in';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanId,
  CommissionNodeState,
  CommissionOfferContent,
  CommissionRequirementEntry,
  CommissionRowViewModel,
  DroppedReward,
  GameState,
  WorldNodeEntry,
} from '@interfaces';

function commissionState(
  caravanId: CaravanId,
  state: GameState = gamestate(),
): CommissionNodeState | undefined {
  return state.world.commissions[caravanId];
}

// Shaped like CraftRequirementEntry so both UI surfaces (the Commissions
// panel and a caravan's trade modal) can reuse the same icon-row rendering
// the tradeskill panel already uses for recipe requirements.
export function commissionRequirementEntries(
  caravanId: CaravanId,
): CommissionRequirementEntry[] {
  const state = commissionState(caravanId);
  if (!state) return [];

  return buildCommissionRequirementEntries(state.requirements);
}

// False until the first `commissionProcessTick` has generated this
// caravan's commission - lets the UI skip rendering an empty row.
export function commissionExists(caravanId: CaravanId): boolean {
  return !!commissionState(caravanId)?.commissionOfferId;
}

export function commissionRewards(caravanId: CaravanId): DroppedReward[] {
  const state = commissionState(caravanId);
  const offer = state?.commissionOfferId
    ? getEntry<CommissionOfferContent>(state.commissionOfferId)
    : undefined;

  return offer?.rewards ?? [];
}

// Accepts an explicit `state` to re-validate at commit time (see `commissionRequirementOwnedQuantity`).
export function commissionCanFulfill(
  caravanId: CaravanId,
  state?: GameState,
): boolean {
  const nodeState = commissionState(caravanId, state);
  if (!nodeState || nodeState.completed || !nodeState.commissionOfferId) {
    return false;
  }

  return nodeState.requirements.every(
    (requirement) =>
      commissionRequirementOwnedQuantity(requirement, state) >=
      requirement.quantity,
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
    title: caravan.name,
    requirementEntries: commissionRequirementEntries(caravan.id),
    rewards: commissionRewards(caravan.id),
    canFulfill: commissionCanFulfill(caravan.id),
    completed: !!commissionState(caravan.id)?.completed,
    isPartyHere: isPartyAtCaravan(caravan.id),
    canTravel: canPartyTravel(),
    travelEtaSeconds: travelEtaSecondsTo(entry.nodeName),
  };
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
  let offerName: string | undefined;

  await updateGamestate((s) => {
    if (!commissionCanFulfill(caravanId, s)) return s;

    const nodeState = s.world.commissions[caravanId];
    if (!nodeState?.commissionOfferId) return s;

    const offer = getEntry<CommissionOfferContent>(nodeState.commissionOfferId);
    offerName = offer?.name;

    spendCommissionRequirements(s, nodeState.requirements);
    if (offer) grantCommissionRewards(s, offer);
    nodeState.completed = true;
    fulfilled = true;

    return s;
  });

  if (fulfilled && offerName) {
    analyticsSendDesignEvent(
      `Kingdom:Commission:Fulfill:${analyticsSafeSegment(offerName)}`,
    );
  }
  return fulfilled;
}
