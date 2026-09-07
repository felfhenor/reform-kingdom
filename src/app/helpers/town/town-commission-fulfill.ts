import {
  buildCommissionRequirementEntries,
  commissionRequirementsSatisfied,
} from '@helpers/commission/commission-requirement';
import { spendCommissionRequirements } from '@helpers/commission/commission-turn-in';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { canPartyTravel, travelEtaSecondsTo } from '@helpers/hero/travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townReputationGain } from '@helpers/town/reputation/town-reputation';
import { depositCommissionRequirementsToTown } from '@helpers/town/town-materials';
import { isPartyAtTown } from '@helpers/town/town-visit';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type {
  CommissionOfferContent,
  CommissionRequirementEntry,
  GameState,
  TownCommissionRowViewModel,
  TownCommissionSlotId,
  TownCommissionSlotState,
  TownContent,
  TownId,
  WorldNodeEntry,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

function commissionSlots(
  townId: TownId,
  state: GameState = gamestate(),
): TownCommissionSlotState[] {
  return state.world.towns[townId]?.commissionSlots ?? [];
}

function findSlot(
  townId: TownId,
  slotId: TownCommissionSlotId,
  state?: GameState,
): TownCommissionSlotState | undefined {
  return commissionSlots(townId, state).find((slot) => slot.id === slotId);
}

export function townCommissionRequirementEntries(
  townId: TownId,
  slotId: TownCommissionSlotId,
): CommissionRequirementEntry[] {
  const slot = findSlot(townId, slotId);
  return slot ? buildCommissionRequirementEntries(slot.requirements) : [];
}

// Towns pay reputation instead of the offer's normal rewards (scrip/materials).
export function townCommissionReputationReward(
  townId: TownId,
  slotId: TownCommissionSlotId,
): number {
  const slot = findSlot(townId, slotId);
  const offer = slot
    ? getEntry<CommissionOfferContent>(slot.commissionOfferId)
    : undefined;

  return offer?.townReputationReward ?? 0;
}

export function townCommissionCanFulfill(
  townId: TownId,
  slotId: TownCommissionSlotId,
  state?: GameState,
): boolean {
  const slot = findSlot(townId, slotId, state);
  return !!slot && commissionRequirementsSatisfied(slot.requirements, state);
}

// Persistence lives on the town's own authored commission-slot entry, not on the shared offer content.
function isSlotPersistent(
  town: TownContent,
  slot: TownCommissionSlotState,
): boolean {
  return town.defense.quests.commissions.some(
    (entry) =>
      entry.commissionOfferId === slot.commissionOfferId && entry.persistent,
  );
}

// Every active slot becomes its own row - unlike a caravan (always exactly one live commission), a town can have several at once.
// Persistent slots (always-available, e.g. a standing gold-for-reputation offer) sort first.
export function townCommissionRowViewModels(
  entry: WorldNodeEntry,
): TownCommissionRowViewModel[] {
  const town = worldNodeTown(entry);
  if (!town) return [];

  const isPartyHere = isPartyAtTown(town.id);
  const canTravel = canPartyTravel();
  const travelEtaSeconds = travelEtaSecondsTo(entry.nodeName);

  return sortBy(
    [...commissionSlots(town.id)],
    (slot: TownCommissionSlotState) => -isSlotPersistent(town, slot),
  ).map((slot) => ({
    townId: town.id,
    slotId: slot.id,
    nodeName: entry.nodeName,
    title: town.name,
    requirementEntries: townCommissionRequirementEntries(town.id, slot.id),
    rewards: [],
    reputationReward: townCommissionReputationReward(town.id, slot.id),
    canFulfill: townCommissionCanFulfill(town.id, slot.id),
    completed: false,
    isPartyHere,
    canTravel,
    travelEtaSeconds,
  }));
}

// Fast path only - the check is repeated against live state inside the callback, since updateGamestate commits asynchronously.
export async function townCommissionFulfill(
  townId: TownId,
  slotId: TownCommissionSlotId,
): Promise<boolean> {
  if (!townCommissionCanFulfill(townId, slotId) || !isPartyAtTown(townId)) {
    return false;
  }

  const townData = getEntry<TownContent>(townId);
  if (!townData) return false;

  let fulfilled = false;
  let offerName: string | undefined;
  let reputationAmount = 0;

  await updateGamestate((s) => {
    const target = s.world.towns[townId];
    if (!target) return s;

    const slot = target.commissionSlots.find((entry) => entry.id === slotId);
    if (!slot || !commissionRequirementsSatisfied(slot.requirements, s)) {
      return s;
    }

    const offer = getEntry<CommissionOfferContent>(slot.commissionOfferId);
    offerName = offer?.name;
    reputationAmount = offer?.townReputationReward ?? 0;

    spendCommissionRequirements(s, slot.requirements);
    depositCommissionRequirementsToTown(s, townId, slot.requirements);

    if (!isSlotPersistent(townData, slot)) {
      target.commissionSlots = target.commissionSlots.filter(
        (entry) => entry.id !== slotId,
      );
    }

    fulfilled = true;

    return s;
  });

  if (fulfilled) {
    townReputationGain(townId, reputationAmount, 'Commission');
    if (offerName) {
      analyticsSendDesignEvent(
        `Town:Commission:Fulfill:${analyticsSafeSegment(offerName)}`,
      );
    }
  }
  return fulfilled;
}
