import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/item/materials', () => ({
  goldCoinId: vi.fn(() => 'gold-coin'),
}));

vi.mock('@helpers/state-game', () => ({
  worldTownsState: vi.fn(() => ({})),
}));

vi.mock('@helpers/town/raid/town-raid-defense', () => ({
  raidTelegraphClear: vi.fn(),
}));

vi.mock('@helpers/commission/commission-turn-in', () => ({
  spendCommissionRequirements: vi.fn(),
}));

import { spendCommissionRequirements } from '@helpers/commission/commission-turn-in';
import { ensureTown } from '@helpers/content/ensure-town';
import { worldTownsState } from '@helpers/state-game';
import {
  applyRaidBuyoff,
  raidBuyoffCost,
} from '@helpers/town/raid/town-raid-buyoff';
import { raidTelegraphClear } from '@helpers/town/raid/town-raid-defense';
import type {
  GameState,
  ItemId,
  MonsterId,
  TownId,
  TownNodeState,
} from '@interfaces';

const townId = 'larsia' as TownId;

function buildTown(
  tributeGoldScalar = 30,
  fortifyMaterials = [
    { itemId: 'wood' as ItemId, quantityPerAssaulter: 5 },
    { itemId: 'amber' as ItemId, quantityPerAssaulter: 0.5 },
  ],
) {
  return ensureTown({
    id: townId,
    name: 'Larsia',
    defense: {
      rewards: [],
      guardian: { reputationTiers: [] },
      assaulter: {
        numMonsters: 12,
        monsterIds: [],
        level: { min: 15, max: 22 },
      },
      quests: { commissions: [] },
      buyoff: { tributeGoldScalar, fortifyMaterials },
    },
  });
}

function buildState(assaulterCount: number | undefined): GameState {
  const raidTelegraphedAssaulterIds =
    assaulterCount === undefined
      ? undefined
      : Array.from({ length: assaulterCount }, () => 'Bloodmoth' as MonsterId);

  return {
    world: {
      towns: {
        [townId]: {
          raidTelegraphedAtTick: 100,
          raidEngageWindowExpiresAtTick: 500,
          raidTelegraphedAssaulterIds,
        } as TownNodeState,
      },
    },
  } as unknown as GameState;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('raidBuyoffCost', () => {
  it('scales tribute gold by assaulter count and assaulter level', () => {
    expect(raidBuyoffCost(buildTown(), 'Tribute', buildState(4))).toEqual([
      { itemId: 'gold-coin', quantity: 30 * 4 * 22 },
    ]);
  });

  it('rounds fractional tribute gold up', () => {
    expect(raidBuyoffCost(buildTown(0.3), 'Tribute', buildState(3))).toEqual([
      { itemId: 'gold-coin', quantity: 20 },
    ]);
  });

  it('scales fortify materials by assaulter count, rounding up', () => {
    expect(raidBuyoffCost(buildTown(), 'Fortify', buildState(3))).toEqual([
      { itemId: 'wood', quantity: 15 },
      { itemId: 'amber', quantity: 2 },
    ]);
  });

  it('uses the telegraphed assaulters, not the configured numMonsters', () => {
    const [tribute] = raidBuyoffCost(buildTown(), 'Tribute', buildState(1));

    expect(tribute.quantity).toBe(30 * 22);
  });

  it('costs nothing (so is unavailable) when no raid is telegraphed', () => {
    expect(
      raidBuyoffCost(buildTown(), 'Tribute', buildState(undefined)),
    ).toEqual([]);
    expect(raidBuyoffCost(buildTown(), 'Fortify', buildState(0))).toEqual([]);
  });

  it('is unavailable when the town configures no such option', () => {
    const town = buildTown(0, []);

    expect(raidBuyoffCost(town, 'Tribute', buildState(4))).toEqual([]);
    expect(raidBuyoffCost(town, 'Fortify', buildState(4))).toEqual([]);
  });

  it('reads the live selector when no state is passed', () => {
    vi.mocked(worldTownsState).mockReturnValue(buildState(2).world.towns);

    expect(raidBuyoffCost(buildTown(), 'Tribute')).toEqual([
      { itemId: 'gold-coin', quantity: 30 * 2 * 22 },
    ]);
  });
});

describe('applyRaidBuyoff', () => {
  it('spends the cost, starts the cooldown, and clears the telegraph', () => {
    const state = buildState(4);
    const cost = [{ itemId: 'wood' as ItemId, quantity: 20 }];

    applyRaidBuyoff(state, townId, cost, 1000);

    expect(spendCommissionRequirements).toHaveBeenCalledWith(state, cost);
    expect(state.world.towns[townId].lastRaidResolvedAtTick).toBe(1000);
    expect(state.world.towns[townId].craftSpeedDebuffExpiresAtTick).toBe(
      undefined,
    );
    expect(raidTelegraphClear).toHaveBeenCalledWith(state, townId, 1000);
  });

  it('does nothing for a town with no state', () => {
    const state = { world: { towns: {} } } as unknown as GameState;

    applyRaidBuyoff(state, townId, [], 1000);

    expect(spendCommissionRequirements).not.toHaveBeenCalled();
    expect(raidTelegraphClear).not.toHaveBeenCalled();
  });
});
