import { categoryMessageLog } from '@helpers/combat/combat-log';
import {
  buildCommissionRequirementEntries,
  commissionRequirementsSatisfied,
} from '@helpers/commission/commission-requirement';
import { RAID_BUYOFF_REPUTATION_AMOUNT } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { updateGamestate } from '@helpers/state-game';
import {
  applyRaidBuyoff,
  raidBuyoffCost,
} from '@helpers/town/raid/town-raid-buyoff';
import { townReputationGainAndRefresh } from '@helpers/town/reputation/town-reputation-grant';
import { isPartyAtTown } from '@helpers/town/town-visit';
import type {
  CostItem,
  TownContent,
  TownId,
  TownRaidBuyoffKind,
  TownRaidBuyoffOption,
} from '@interfaces';

const RAID_BUYOFF_LABELS: Record<TownRaidBuyoffKind, string> = {
  Tribute: 'Pay Tribute',
  Fortify: 'Fortify',
};

const RAID_BUYOFF_LOG_MESSAGES: Record<
  TownRaidBuyoffKind,
  (townName: string) => string
> = {
  Tribute: (townName) =>
    `You paid tribute to ${townName}, allowing them to quickly bolster their defenses.`,
  Fortify: (townName) =>
    `You fortified ${townName}, leading to an overwhelmingly successful defense.`,
};

export function raidBuyoffOptions(town: TownContent): TownRaidBuyoffOption[] {
  const isPartyHere = isPartyAtTown(town.id);

  return (Object.keys(RAID_BUYOFF_LABELS) as TownRaidBuyoffKind[])
    .map((kind) => ({ kind, cost: raidBuyoffCost(town, kind) }))
    .filter(({ cost }) => cost.length > 0)
    .map(({ kind, cost }) => ({
      kind,
      label: RAID_BUYOFF_LABELS[kind],
      requirementEntries: buildCommissionRequirementEntries(cost).map(
        (req) => ({
          itemId: req.content?.id,
          required: req.quantity,
        }),
      ) as CostItem[],
      canBuyoff: isPartyHere && commissionRequirementsSatisfied(cost),
    }));
}

// Fast path only - the cost is re-rolled and re-validated against live state inside the callback.
export async function raidBuyoff(
  townId: TownId,
  kind: TownRaidBuyoffKind,
): Promise<boolean> {
  const town = getEntry<TownContent>(townId);
  if (!town || !isPartyAtTown(townId)) return false;

  let paid = false;

  await updateGamestate((state) => {
    const expiresAtTick =
      state.world.towns[townId]?.raidEngageWindowExpiresAtTick;
    // The loss only lands on the next raid check, so an expired window must not be buyable in the gap.
    if (expiresAtTick === undefined || state.clock.numTicks >= expiresAtTick) {
      return state;
    }

    const cost = raidBuyoffCost(town, kind, state);
    if (cost.length === 0 || !commissionRequirementsSatisfied(cost, state)) {
      return state;
    }

    applyRaidBuyoff(state, townId, cost, state.clock.numTicks);
    paid = true;
    return state;
  });

  if (!paid) return false;

  analyticsSendDesignEvent(
    `Town:Raid:${kind}:${analyticsSafeSegment(town.name)}`,
  );
  categoryMessageLog(
    'Raid',
    town.name,
    RAID_BUYOFF_LOG_MESSAGES[kind](town.name),
  );
  await townReputationGainAndRefresh(
    townId,
    RAID_BUYOFF_REPUTATION_AMOUNT,
    'RaidBuyoff',
  );

  return true;
}
