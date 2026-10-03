import { describe, expect, it } from 'vitest';

import { commissionRecordMonsterKill } from '@helpers/commission/commission-kill-progress';
import { worldCommissionsState, worldTownsState } from '@helpers/state-game';
import type {
  CaravanId,
  CommissionOfferId,
  CommissionRequirement,
  ItemId,
  MonsterId,
  TownCommissionSlotId,
  TownId,
} from '@interfaces';
import {
  buildCommissionNodeState,
  buildTownNodeState,
} from '@/testing/builders';
import { inTick, seedGamestate } from '@/testing/gamestate';

const caravanId = 'carrina-duchy' as CaravanId;
const townId = 'larsia' as TownId;
const wormId = 'sand-worm' as MonsterId;
const offerId = 'offer-a' as CommissionOfferId;

const worms = (progress: number, monsterId = wormId) => ({
  monsterId,
  quantity: 5,
  progress,
});

function seedCommissions(
  caravan: CommissionRequirement[],
  town: CommissionRequirement[] = [],
  completed = false,
): void {
  seedGamestate((state) => {
    state.world.commissions[caravanId] = buildCommissionNodeState({
      commissionOfferId: offerId,
      requirements: caravan,
      completed,
    });
    state.world.towns[townId] = buildTownNodeState({
      commissionSlots: [
        {
          id: 'slot-1' as TownCommissionSlotId,
          commissionOfferId: offerId,
          requirements: town,
          generatedAtTick: 0,
        },
      ],
    });
  });
}

const kill = (count?: number) =>
  inTick(() => commissionRecordMonsterKill(wormId, count));

function caravanRequirements(): CommissionRequirement[] {
  return worldCommissionsState()[caravanId].requirements;
}

function townRequirements(): CommissionRequirement[] {
  return worldTownsState()[townId].commissionSlots[0].requirements;
}

describe('commissionRecordMonsterKill', () => {
  it('counts the kill toward every open caravan and town commission for that monster', () => {
    const sticks = { itemId: 'stick' as ItemId, quantity: 100 };
    seedCommissions(
      [worms(1), sticks, worms(1, 'bat' as MonsterId)],
      [worms(3)],
    );

    kill();

    expect(caravanRequirements()).toEqual([
      worms(2),
      sticks,
      worms(1, 'bat' as MonsterId),
    ]);
    expect(townRequirements()).toEqual([worms(4)]);
  });

  it('adds the whole count, never past the required quantity', () => {
    seedCommissions([worms(1)]);

    kill(3);
    expect(caravanRequirements()).toEqual([worms(4)]);

    kill(10);
    expect(caravanRequirements()).toEqual([worms(5)]);
  });

  it('leaves a completed caravan commission alone', () => {
    seedCommissions([worms(1)], [worms(1)], true);

    kill();

    expect(caravanRequirements()).toEqual([worms(1)]);
    expect(townRequirements()).toEqual([worms(2)]);
  });
});
