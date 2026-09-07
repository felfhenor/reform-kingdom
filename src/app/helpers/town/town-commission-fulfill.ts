import {
  buildCommissionRequirementEntries,
  commissionRequirementsSatisfied,
} from '@helpers/commission/commission-requirement';
import { getEntry } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import type {
  CommissionOfferContent,
  CommissionRequirementEntry,
  GameState,
  TownCommissionSlotId,
  TownCommissionSlotState,
  TownId,
} from '@interfaces';

export function commissionSlots(
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
