import {
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { getEntriesByType } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { rngChoiceWeighted, rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import {
  townReputationTier,
  townReputationTierMultiplier,
} from '@helpers/town/reputation/town-reputation';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  CommissionOfferContent,
  EligibleCommissionOffer,
  TownCommissionSlotId,
  TownContent,
  TownNodeState,
} from '@interfaces';

// Same cadence as every other town subsystem (worker/craft/shop).
const TOWN_COMMISSION_TICK_INTERVAL = 1;

// A shared game-balance curve, not authored per-town - same convention as TOWN_REPUTATION_THRESHOLDS.
const TOWN_COMMISSION_SLOT_COUNTS: Record<number, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
};

export function townCommissionSlotCount(town: TownContent): number {
  const tier = townReputationTier(town.id);
  return townReputationTierMultiplier(tier, TOWN_COMMISSION_SLOT_COUNTS) ?? 1;
}

function addCommissionSlot(
  target: TownNodeState,
  offer: CommissionOfferContent,
): void {
  target.commissionSlots = [
    ...target.commissionSlots,
    {
      id: rngUuid() as TownCommissionSlotId,
      commissionOfferId: offer.id,
      requirements: rollCommissionRequirements(offer),
      generatedAtTick: timerTicksElapsed(),
    },
  ];
}

// Persistence lives on the town's own commission-slot entry (TownCommissionOfferSlot), not on the shared CommissionOfferContent.
function partitionByPersistence(town: TownContent): {
  persistent: EligibleCommissionOffer[];
  rolled: EligibleCommissionOffer[];
} {
  const slots = town.defense.quests.commissions;
  return {
    persistent: eligibleCommissionOffers(slots.filter((s) => s.persistent)),
    rolled: eligibleCommissionOffers(slots.filter((s) => !s.persistent)),
  };
}

// Persistent offers always have exactly one live slot - outside the reputation-scaled cap, never part of the weighted roll below.
function ensurePersistentCommissionSlots(
  target: TownNodeState,
  persistent: EligibleCommissionOffer[],
): void {
  persistent.forEach(({ offer }) => {
    const alreadyPresent = target.commissionSlots.some(
      (slot) => slot.commissionOfferId === offer.id,
    );
    if (!alreadyPresent) addCommissionSlot(target, offer);
  });
}

// Persistent slots don't count against the cap - only rolled ones do.
function fillEmptyCommissionSlots(
  town: TownContent,
  target: TownNodeState,
  rolled: EligibleCommissionOffer[],
  persistentOfferIds: Set<CommissionOfferContent['id']>,
): void {
  const maxSlots = townCommissionSlotCount(town);
  const rolledSlotCount = () =>
    target.commissionSlots.filter(
      (slot) => !persistentOfferIds.has(slot.commissionOfferId),
    ).length;

  while (rolledSlotCount() < maxSlots) {
    // Recomputed every iteration so an offer just rolled into a slot can't be rolled again this same tick.
    const activeOfferIds = new Set(
      target.commissionSlots.map((slot) => slot.commissionOfferId),
    );
    const candidates = rolled.filter((o) => !activeOfferIds.has(o.offer.id));
    const picked = rngChoiceWeighted(candidates, (o) => o.weight);
    if (!picked) return; // no eligible offer - stop retrying this tick

    addCommissionSlot(target, picked.offer);
  }
}

export function townCommissionProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (
      !isTownDueForUpdate(town.id, 'quest', TOWN_COMMISSION_TICK_INTERVAL)
    ) {
      return;
    }

    updateGamestate((state) => {
      const target = state.world.towns[town.id];
      if (!target) return state;

      const { persistent, rolled } = partitionByPersistence(town);
      const persistentOfferIds = new Set(persistent.map((p) => p.offer.id));

      ensurePersistentCommissionSlots(target, persistent);
      fillEmptyCommissionSlots(town, target, rolled, persistentOfferIds);
      return state;
    });
    markTownSubsystemProcessed(town.id, 'quest');
  });
}
