import { beforeEach, describe, expect, it } from 'vitest';

import { ensureItem } from '@helpers/content/ensure-item';
import { ensureTown } from '@helpers/content/ensure-town';
import { applyMaterialDelta } from '@helpers/item/materials';
import {
  applyRaidBuyoff,
  raidBuyoffCost,
} from '@helpers/town/raid/town-raid-buyoff';
import type { GameState, ItemId, MonsterId, TownId } from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const goldCoin = ensureItem({ id: 'gold-coin' as ItemId, name: 'Gold Coin' });
const wood = 'wood' as ItemId;
const amber = 'amber' as ItemId;

function town(
  tributeGoldScalar = 30,
  fortifyMaterials = [
    { itemId: wood, quantityPerAssaulter: 5 },
    { itemId: amber, quantityPerAssaulter: 0.5 },
  ],
) {
  return ensureTown({
    id: 'larsia' as TownId,
    name: 'Larsia',
    defense: {
      assaulter: { numMonsters: 12, level: { min: 15, max: 22 } },
      buyoff: { tributeGoldScalar, fortifyMaterials },
    },
  });
}

// A raid telegraphed with `assaulters` monsters; undefined = no raid pending.
function seedRaid(
  assaulters: number | undefined,
  edit?: (state: GameState) => void,
): GameState {
  return seedGamestate((state) => {
    state.world.towns[town().id] = buildTownNodeState({
      raidTelegraphedAtTick: assaulters === undefined ? undefined : 100,
      raidEngageWindowExpiresAtTick: assaulters === undefined ? undefined : 500,
      raidTelegraphedAssaulterIds:
        assaulters === undefined
          ? undefined
          : Array.from({ length: assaulters }, () => 'moth' as MonsterId),
    });
    edit?.(state);
  });
}

beforeEach(() => {
  seedContent([goldCoin, town()]);
});

describe('raidBuyoffCost', () => {
  it('prices tribute gold by telegraphed assaulters and their top level, rounding up', () => {
    seedRaid(4);
    expect(raidBuyoffCost(town(), 'Tribute')).toEqual([
      { itemId: goldCoin.id, quantity: 30 * 4 * 22 },
    ]);

    seedRaid(3);
    expect(raidBuyoffCost(town(0.3), 'Tribute')).toEqual([
      { itemId: goldCoin.id, quantity: 20 },
    ]);
  });

  it('prices fortify materials per telegraphed assaulter, rounding up and skipping free ones', () => {
    seedRaid(3);
    const withFreeMaterial = town(30, [
      { itemId: wood, quantityPerAssaulter: 5 },
      { itemId: 'free' as ItemId, quantityPerAssaulter: 0 },
      { itemId: amber, quantityPerAssaulter: 0.5 },
    ]);

    expect(raidBuyoffCost(withFreeMaterial, 'Fortify')).toEqual([
      { itemId: wood, quantity: 15 },
      { itemId: amber, quantity: 2 },
    ]);
  });

  it('reads a given state over live state', () => {
    const twoAssaulters = seedRaid(2);
    seedRaid(4);

    expect(raidBuyoffCost(town(), 'Tribute', twoAssaulters)).toEqual([
      { itemId: goldCoin.id, quantity: 30 * 2 * 22 },
    ]);
  });

  it('is unavailable with no raid pending, or no such option in the town', () => {
    seedRaid(undefined);
    expect(raidBuyoffCost(town(), 'Tribute')).toEqual([]);

    seedRaid(0);
    expect(raidBuyoffCost(town(), 'Fortify')).toEqual([]);

    seedRaid(4);
    expect(raidBuyoffCost(town(0, []), 'Tribute')).toEqual([]);
    expect(raidBuyoffCost(town(0, []), 'Fortify')).toEqual([]);
  });
});

describe('applyRaidBuyoff', () => {
  it('spends the cost, starts the raid cooldown and ends the raid', () => {
    const state = structuredClone(
      seedRaid(4, (draft) => applyMaterialDelta(draft, wood, 25)),
    );

    applyRaidBuyoff(state, town().id, [{ itemId: wood, quantity: 20 }], 1000);

    expect(state.materials[wood]?.quantity).toBe(5);
    expect(state.world.towns[town().id]).toMatchObject({
      lastRaidResolvedAtTick: 1000,
      raidTelegraphedAtTick: undefined,
      raidTelegraphedAssaulterIds: undefined,
    });
    expect(
      state.world.towns[town().id].craftSpeedDebuffExpiresAtTick,
    ).toBeUndefined();
  });

  it('does nothing for a town without state', () => {
    const state = structuredClone(
      seedGamestate((draft) => applyMaterialDelta(draft, wood, 25)),
    );

    applyRaidBuyoff(state, town().id, [{ itemId: wood, quantity: 20 }], 1000);

    expect(state.materials[wood]?.quantity).toBe(25);
    expect(state.world.towns[town().id]).toBeUndefined();
  });
});
