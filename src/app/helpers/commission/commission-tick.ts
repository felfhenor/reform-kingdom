import { mostRecentCommissionResetAt } from '@helpers/commission/commission-reset';
import {
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { getEntry } from '@helpers/content/content';
import { rngChoiceWeighted } from '@helpers/rng';
import { updateGamestate, worldCommissionsState } from '@helpers/state-game';
import {
  worldNodeCaravan,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CommissionNodeState,
  CommissionOfferContent,
  GameStateCommissions,
} from '@interfaces';

function isDueForRegeneration(
  state: CommissionNodeState | undefined,
  now: number,
): boolean {
  if (!state) return true;
  // Seeded on a new game's first tick, so a reset soon after would wipe it before the player can reach it.
  if (state.isStartingCommission && !state.completed) return false;
  return state.generatedAt < mostRecentCommissionResetAt(now);
}

function rollCommissionOffer(
  caravan: CaravanContent,
): CommissionOfferContent | undefined {
  return rngChoiceWeighted(
    eligibleCommissionOffers(caravan.commissionOffers),
    (s) => s.weight,
  )?.offer;
}

// Leaves state untouched (rather than writing an empty stub) when no offer
// resolves, so the next visit/tick retries instead of waiting a full day -
// e.g. content hadn't finished loading yet when this first ran.
function regenerateCommissionNode(
  caravan: CaravanContent,
  now: number,
  isFirst: boolean,
): void {
  const starting = isFirst
    ? getEntry<CommissionOfferContent>(caravan.startingCommissionOfferId)
    : undefined;
  const offer = starting ?? rollCommissionOffer(caravan);
  if (!offer) return;

  updateGamestate((state) => {
    state.world.commissions[caravan.id] = {
      commissionOfferId: offer.id,
      requirements: rollCommissionRequirements(offer),
      completed: false,
      generatedAt: now,
      ...(starting ? { isStartingCommission: true } : {}),
    };
    return state;
  });
}

// No-ops if a commission already exists, even a stale one.
export function commissionGenerateIfMissing(caravanId: CaravanId): void {
  if (worldCommissionsState()[caravanId]) return;

  const caravan = getEntry<CaravanContent>(caravanId);
  if (!caravan) return;

  regenerateCommissionNode(caravan, Date.now(), true);
}

// Regenerates every CaravanNode's commission once the daily wall-clock reset
// boundary has passed - checks real time instead of ticks elapsed.
export function commissionProcessTick(): void {
  const now = Date.now();

  worldNodesOfType('CaravanNode').forEach((entry) => {
    const content = worldNodeCaravan(entry);
    if (!content) return;

    const state = worldCommissionsState()[content.id];
    if (!isDueForRegeneration(state, now)) return;

    regenerateCommissionNode(content, now, !state);
  });
}

// Drops any commission keyed by a caravan, or referencing an offer, that no
// longer resolves to real content.
export function pruneInvalidCommissions(
  commissions: GameStateCommissions,
): GameStateCommissions {
  const pruned: GameStateCommissions = {};

  (Object.keys(commissions) as CaravanId[]).forEach((caravanId) => {
    if (!getEntry<CaravanContent>(caravanId)) return;

    const state = commissions[caravanId];
    if (
      !state.commissionOfferId ||
      getEntry<CommissionOfferContent>(state.commissionOfferId)
    ) {
      pruned[caravanId] = state;
    }
  });

  return pruned;
}
