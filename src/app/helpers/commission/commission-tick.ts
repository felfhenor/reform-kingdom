import { mostRecentCommissionResetAt } from '@helpers/commission/commission-reset';
import { getEntry } from '@helpers/content';
import { rngChoiceWeighted, rngNumberRange } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  worldNodeCaravan,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  CaravanContent,
  CaravanId,
  CommissionNodeState,
  CommissionOfferContent,
  CommissionOfferSlot,
  CommissionRequirement,
  GameStateCommissions,
} from '@interfaces';

type EligibleSlot = { offer: CommissionOfferContent; weight: number };

function isDueForRegeneration(
  state: CommissionNodeState | undefined,
  now: number,
): boolean {
  if (!state) return true;
  return state.generatedAt < mostRecentCommissionResetAt(now);
}

function eligibleSlots(caravan: CaravanContent): EligibleSlot[] {
  return caravan.commissionOffers
    .map((slot: CommissionOfferSlot) => {
      const offer = getEntry<CommissionOfferContent>(slot.commissionOfferId);
      return offer ? { offer, weight: slot.weight } : undefined;
    })
    .filter((slot): slot is EligibleSlot => !!slot);
}

function rollRequirements(
  offer: CommissionOfferContent,
): CommissionRequirement[] {
  return offer.requirements.map((requirement) => {
    const quantity = rngNumberRange(
      requirement.quantityMin,
      requirement.quantityMax,
    );

    return 'equipmentId' in requirement
      ? { equipmentId: requirement.equipmentId, quantity }
      : { itemId: requirement.itemId, quantity };
  });
}

// Leaves state untouched (rather than writing an empty stub) when no offer
// resolves, so the next visit/tick retries instead of waiting a full day -
// e.g. content hadn't finished loading yet when this first ran.
function regenerateCommissionNode(caravan: CaravanContent, now: number): void {
  const slot = rngChoiceWeighted(eligibleSlots(caravan), (s) => s.weight);
  const offer = slot?.offer;
  if (!offer) return;

  updateGamestate((state) => {
    state.world.commissions[caravan.id] = {
      commissionOfferId: offer.id,
      requirements: rollRequirements(offer),
      completed: false,
      generatedAt: now,
    };
    return state;
  });
}

// Backfills a missing commission on arrival instead of waiting for the next
// commissionProcessTick. No-ops if a commission already exists, even a stale one.
export function commissionGenerateIfMissing(caravanId: CaravanId): void {
  if (gamestate().world.commissions[caravanId]) return;

  const caravan = getEntry<CaravanContent>(caravanId);
  if (!caravan) return;

  regenerateCommissionNode(caravan, Date.now());
}

// Regenerates every CaravanNode's commission once the daily wall-clock reset
// boundary has passed - mirrors caravanProcessTick's shape, but checks real
// time instead of ticks elapsed (see commission-reset.ts).
export function commissionProcessTick(): void {
  const now = Date.now();

  worldNodesOfType('CaravanNode').forEach((entry) => {
    const content = worldNodeCaravan(entry);
    if (!content) return;

    const state = gamestate().world.commissions[content.id];
    if (!isDueForRegeneration(state, now)) return;

    regenerateCommissionNode(content, now);
  });
}

// Gates the Commissions tile - true once any caravan has a live commission.
export function hasAnyCommission(): boolean {
  return Object.keys(gamestate().world.commissions).length > 0;
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
