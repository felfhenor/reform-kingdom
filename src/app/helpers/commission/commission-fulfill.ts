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
import { updateGamestate, worldCommissionsState } from '@helpers/state-game';
import {
  taskEventCollectibleGained,
  taskEventWorkerRescued,
} from '@helpers/task/task-events';
import { taskRecordCommissionFulfilled } from '@helpers/task/task-progress';
import type {
  CaravanId,
  CommissionNodeState,
  CommissionOfferContent,
  CommissionRequirementEntry,
  DroppedReward,
  GameState,
  ResolvedDrop,
} from '@interfaces';

export function commissionState(
  caravanId: CaravanId,
  state?: GameState,
): CommissionNodeState | undefined {
  return (state ? state.world.commissions : worldCommissionsState())[caravanId];
}

// Both UI surfaces (the Commissions panel and a caravan's trade modal) can
// reuse the same icon-row rendering the tradeskill panel already uses for
// recipe requirements.
export function commissionRequirementEntries(
  caravanId: CaravanId,
): CommissionRequirementEntry[] {
  const state = commissionState(caravanId);
  if (!state) return [];

  return buildCommissionRequirementEntries(state.requirements);
}

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

// Accepts an explicit `state` to re-validate at commit time.
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

function commissionRecordTaskEvents(drops: ResolvedDrop[]): void {
  void taskRecordCommissionFulfilled();
  drops.forEach((drop) => {
    if (drop.kind === 'Collectible') {
      void taskEventCollectibleGained(drop.collectibleId);
    }
    if (drop.kind === 'Worker') void taskEventWorkerRescued(drop.workerId);
  });
}

export async function commissionFulfill(
  caravanId: CaravanId,
): Promise<boolean> {
  if (!commissionCanFulfill(caravanId) || !isPartyAtCaravan(caravanId)) {
    return false;
  }

  let fulfilled = false;
  let offerName: string | undefined;
  const grantedDrops: ResolvedDrop[] = [];

  await updateGamestate((s) => {
    if (!commissionCanFulfill(caravanId, s)) return s;

    const nodeState = s.world.commissions[caravanId];
    if (!nodeState?.commissionOfferId) return s;

    const offer = getEntry<CommissionOfferContent>(nodeState.commissionOfferId);
    offerName = offer?.name;

    spendCommissionRequirements(s, nodeState.requirements);
    if (offer) grantedDrops.push(...grantCommissionRewards(s, offer));
    nodeState.completed = true;
    fulfilled = true;

    return s;
  });

  if (fulfilled && offerName) {
    analyticsSendDesignEvent(
      `Kingdom:Commission:Fulfill:${analyticsSafeSegment(offerName)}`,
    );
  }
  if (fulfilled) commissionRecordTaskEvents(grantedDrops);
  return fulfilled;
}
