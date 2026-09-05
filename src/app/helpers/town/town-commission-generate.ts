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

function fillEmptyCommissionSlots(
  town: TownContent,
  target: TownNodeState,
): void {
  const maxSlots = townCommissionSlotCount(town);
  const offers = eligibleCommissionOffers(town.defense.quests.commissions);

  while (target.commissionSlots.length < maxSlots) {
    const picked = rngChoiceWeighted(offers, (o) => o.weight);
    if (!picked) return; // no eligible offer - stop retrying this tick

    target.commissionSlots = [
      ...target.commissionSlots,
      {
        id: rngUuid() as TownCommissionSlotId,
        commissionOfferId: picked.offer.id,
        requirements: rollCommissionRequirements(picked.offer),
        generatedAtTick: timerTicksElapsed(),
      },
    ];
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
      if (target) fillEmptyCommissionSlots(town, target);
      return state;
    });
    markTownSubsystemProcessed(town.id, 'quest');
  });
}
