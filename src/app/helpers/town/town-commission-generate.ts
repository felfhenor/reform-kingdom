import {
  eligibleCommissionOffers,
  rollCommissionRequirements,
} from '@helpers/commission/commission-requirement';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { rngChoiceWeighted, rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { townSpecialtyPriority } from '@helpers/town/crafting/town-craft-priority-state';
import {
  townCommissionPriorityWeightFromMap,
  townItemPriorityMap,
} from '@helpers/town/crafting/town-craft-priority-weight';
import {
  townReputationTier,
  townReputationTierMultiplier,
} from '@helpers/town/reputation/town-reputation';
import { townMaterialAtOrAboveThreshold } from '@helpers/town/town-resource-thresholds';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  CommissionOfferContent,
  CommissionOfferId,
  CommissionOfferSlot,
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

function persistentSlotDefs(town: TownContent): CommissionOfferSlot[] {
  return town.defense.quests.commissions.filter((s) => s.persistent);
}

function rolledSlotDefs(town: TownContent): CommissionOfferSlot[] {
  return town.defense.quests.commissions.filter((s) => !s.persistent);
}

// commissionOfferId is already the real content id (gamedata-build.ts resolves it at build time) - no content lookup needed here.
function missingPersistentDefs(
  target: TownNodeState,
  defs: CommissionOfferSlot[],
): CommissionOfferSlot[] {
  return defs.filter(
    (def) =>
      !target.commissionSlots.some(
        (slot) => slot.commissionOfferId === def.commissionOfferId,
      ),
  );
}

function addMissingPersistentSlots(
  target: TownNodeState,
  defs: CommissionOfferSlot[],
): void {
  defs.forEach((def) => {
    const offer = getEntry<CommissionOfferContent>(def.commissionOfferId);
    if (offer) addCommissionSlot(target, offer);
  });
}

function rolledSlotCount(
  target: TownNodeState,
  persistentOfferIds: Set<CommissionOfferId>,
): number {
  return target.commissionSlots.filter(
    (slot) => !persistentOfferIds.has(slot.commissionOfferId),
  ).length;
}

// An offer with any item requirement at/above its threshold is fully excluded - the town won't ask for more of what it already has plenty of.
function isOfferOpenForCommission(
  town: TownContent,
  offer: CommissionOfferContent,
): boolean {
  return offer.requirements.every(
    (requirement) =>
      !('itemId' in requirement) ||
      !townMaterialAtOrAboveThreshold(town, requirement.itemId),
  );
}

// Adds at most one rolled commission per tick - slots trickle in, and content is only resolved on ticks that need a new one.
function addOneRolledCommission(
  town: TownContent,
  target: TownNodeState,
  activeOfferIds: Set<CommissionOfferId>,
): void {
  const candidates = eligibleCommissionOffers(rolledSlotDefs(town)).filter(
    (o) =>
      !activeOfferIds.has(o.offer.id) &&
      isOfferOpenForCommission(town, o.offer),
  );

  const priority = townSpecialtyPriority(town.id);
  const priorityMap = townItemPriorityMap(priority);
  const picked = rngChoiceWeighted(
    candidates,
    (o) =>
      o.weight *
      townCommissionPriorityWeightFromMap(
        priority,
        priorityMap,
        o.offer,
        o.weight,
      ),
  );
  if (!picked) return;

  addCommissionSlot(target, picked.offer);
}

export function townCommissionProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'quest', TOWN_COMMISSION_TICK_INTERVAL)) {
      return;
    }

    updateGamestate((state) => {
      const target = state.world.towns[town.id];
      if (!target) return state;

      const persistentDefs = persistentSlotDefs(town);
      const persistentOfferIds = new Set(
        persistentDefs.map((def) => def.commissionOfferId),
      );
      const missingPersistent = missingPersistentDefs(target, persistentDefs);
      const needsRolledFill =
        rolledSlotCount(target, persistentOfferIds) <
        townCommissionSlotCount(town);

      // Nothing to add this tick - skip every content resolution below entirely, not just the weighted pick.
      if (missingPersistent.length === 0 && !needsRolledFill) return state;

      addMissingPersistentSlots(target, missingPersistent);

      if (needsRolledFill) {
        const activeOfferIds = new Set(
          target.commissionSlots.map((slot) => slot.commissionOfferId),
        );
        addOneRolledCommission(town, target, activeOfferIds);
      }

      return state;
    });
    markTownSubsystemProcessed(town.id, 'quest');
  });
}
