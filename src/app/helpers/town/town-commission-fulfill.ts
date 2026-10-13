import {
  buildCommissionRequirementEntries,
  commissionOfferReputationReward,
  commissionRequirementsSatisfied,
} from '@helpers/commission/commission-requirement';
import { getEntry } from '@helpers/content/content';
import { jobAbilityValue } from '@helpers/hero/job-ability';
import { worldTownsState } from '@helpers/state-game';
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
  state?: GameState,
): TownCommissionSlotState[] {
  return (
    (state ? state.world.towns : worldTownsState())[townId]?.commissionSlots ??
    []
  );
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

// Towns pay reputation instead of the offer's normal rewards (scrip/materials). Shared by the preview and the grant so they always match.
export function townCommissionReputationReward(
  townId: TownId,
  slotId: TownCommissionSlotId,
  state?: GameState,
): number {
  const slot = findSlot(townId, slotId, state);
  const offer = slot
    ? getEntry<CommissionOfferContent>(slot.commissionOfferId)
    : undefined;
  if (!offer) return 0;

  const base = commissionOfferReputationReward(offer, townId, state);
  return Math.round(base * (1 + jobAbilityValue('CommissionReputationBoost')));
}

export function townCommissionCanFulfill(
  townId: TownId,
  slotId: TownCommissionSlotId,
  state?: GameState,
): boolean {
  const slot = findSlot(townId, slotId, state);
  return !!slot && commissionRequirementsSatisfied(slot.requirements, state);
}
