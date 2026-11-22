import { beforeEach, describe, expect, it } from 'vitest';

import { ensureCaravanTrader } from '@helpers/content/ensure-caravan';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureExchangeNode } from '@helpers/content/ensure-exchangenode';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import {
  ensureShrine,
  ensureShrineLevel,
} from '@helpers/content/ensure-shrine';
import {
  ensureTask,
  ensureTaskRequirement,
} from '@helpers/content/ensure-task';
import { ensureTown } from '@helpers/content/ensure-town';
import { isCraftedOnly } from '@helpers/item/content-sources';
import { materialCostDemand } from '@helpers/item/material-cost-demand';
import {
  isTaskUnavailableThisRun,
  isUnobtainableThisRun,
  worldNodeDevelopmentObtainableMaxLevel,
} from '@helpers/item/obtainable-this-run';
import type {
  CaravanTraderId,
  EncounterId,
  EquipmentId,
  ExchangeNodeId,
  GatheringId,
  IsContentItem,
  ItemId,
  MonsterId,
  RecipeId,
  ShrineId,
  TaskId,
  TownId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const ore = 'ore' as ItemId;
const ingot = 'ingot' as ItemId;
const peridot = 'peridot' as ItemId;
const gem = 'gem' as ItemId;
const staff = 'staff' as EquipmentId;

const shrine = ensureShrine({
  id: 'shrine' as ShrineId,
  name: 'Shrine',
  levels: [
    ensureShrineLevel({
      developTime: 1,
      costs: [{ itemId: ore, required: 5 }],
    }),
    ensureShrineLevel({
      developTime: 1,
      costs: [{ itemId: ingot, required: 20 }],
    }),
  ],
});
const shrineTask = ensureTask({
  id: 'shrine-task' as TaskId,
  name: 'Shrine Task',
  requirement: ensureTaskRequirement({
    kind: 'ShrineLevel',
    nodeName: 'Shrine',
    level: 2,
  }),
  rewards: [{ itemId: peridot, quantity: 1 }],
});

function seed(extra: IsContentItem[] = []): void {
  seedContent([
    ensureGathering({
      id: 'mine' as GatheringId,
      name: 'Mine',
      levelRange: { min: 1, max: 5 },
      gatherResults: [
        { chance: 1, items: [{ itemId: ore, quantity: 1 }], tradeskillIds: [] },
      ],
    }),
    ensureRecipe({
      id: 'smelt' as RecipeId,
      result: { itemId: ingot, quantity: 1 },
      requirements: [{ itemId: ore, quantity: 1 }],
    }),
    ensureItem({ id: ingot, name: 'Ingot' }),
    ensureMonster({ id: 'goblin' as MonsterId, name: 'Goblin' }),
    ensureEncounter({
      id: 'den' as EncounterId,
      name: 'Den',
      levelRange: { min: 1, max: 10 },
      fights: [{ monsters: [{ monsterId: 'goblin' as MonsterId }] }],
    }),
    shrine,
    shrineTask,
    ensureExchangeNode({
      id: 'altar' as ExchangeNodeId,
      name: 'Altar',
      exchanges: [
        {
          kind: 'Item',
          input: { itemId: ingot, required: 1 },
          output: { itemId: gem, quantity: 1 },
          costs: [],
        },
      ],
    }),
    ...extra,
  ]);
  seedWorldNodes([
    { name: 'Mine', type: 'GatherNode', mapName: 'Hills' },
    { name: 'Den', type: 'ExploreNode', mapName: 'Hills' },
    { name: 'Shrine', type: 'Shrine', mapName: 'Hills' },
    { name: 'Altar', type: 'ExchangeNode', mapName: 'Hills' },
  ]);
}

function withSums(
  tradeskillsDisabled: boolean,
  regionMaterialDropChance = 0,
): void {
  seedGamestate((state) => {
    state.globalEffectSums.tradeskillsDisabled = tradeskillsDisabled;
    state.globalEffectSums.regionMaterialDropChance = regionMaterialDropChance;
  });
}

beforeEach(() => seed());

describe('isCraftedOnly', () => {
  it('ignores one-time sources, but not a repeatable trader sale', () => {
    expect(isCraftedOnly({ itemId: ingot })).toBe(true);
    expect(isCraftedOnly({ itemId: ore })).toBe(false);

    seed([
      ensureCaravanTrader({
        id: 'trader' as CaravanTraderId,
        name: 'Trader',
        trades: [{ type: 'sell', value: 10, itemId: ingot, weight: 1 }],
      }),
    ]);
    expect(isCraftedOnly({ itemId: ingot })).toBe(false);
  });
});

describe('isUnobtainableThisRun', () => {
  it('strips crafted-only items, and what consumes them, while crafting is off', () => {
    withSums(false);
    expect(isUnobtainableThisRun({ itemId: ingot })).toBe(false);
    expect(isUnobtainableThisRun({ itemId: gem })).toBe(false);

    withSums(true);
    expect(isUnobtainableThisRun({ itemId: ingot })).toBe(true);
    expect(isUnobtainableThisRun({ itemId: gem })).toBe(true);
    expect(isUnobtainableThisRun({ itemId: ore })).toBe(false);
  });

  it('counts crafted-only materials again once monsters drop them', () => {
    withSums(true, 10);
    expect(isUnobtainableThisRun({ itemId: ingot })).toBe(false);
  });

  it('strips town-crafted equipment only while town shops sell no equipment', () => {
    seed([
      ensureEquipment({ id: staff, name: 'Staff' }),
      ensureRecipe({
        id: 'r-staff' as RecipeId,
        result: { equipmentId: staff },
      }),
      ensureTown({
        id: 'town' as TownId,
        name: 'Town',
        crafting: { uniqueRecipeIds: ['r-staff' as RecipeId] },
      }),
    ]);
    seedGamestate();
    expect(isUnobtainableThisRun({ equipmentId: staff })).toBe(false);

    seedGamestate((state) => {
      state.globalEffectSums.townShopNoEquipment = true;
    });
    expect(isUnobtainableThisRun({ equipmentId: staff })).toBe(true);
  });
});

describe('development caps', () => {
  it('stops at the first level with a cost this run cannot supply, taking its task and reward with it', () => {
    withSums(false);
    expect(worldNodeDevelopmentObtainableMaxLevel(shrine)).toBe(2);
    expect(isTaskUnavailableThisRun(shrineTask)).toBe(false);
    expect(isUnobtainableThisRun({ itemId: peridot })).toBe(false);

    withSums(true);
    expect(worldNodeDevelopmentObtainableMaxLevel(shrine)).toBe(1);
    expect(isTaskUnavailableThisRun(shrineTask)).toBe(true);
    expect(isUnobtainableThisRun({ itemId: peridot })).toBe(true);
  });
});

describe('region drop sources', () => {
  it('count gear only where a fight on its home map is in its level window', () => {
    seed([
      ensureEquipment({
        id: 'dagger' as EquipmentId,
        name: 'Dagger',
        levelRequirement: 5,
      }),
      ensureRecipe({
        id: 'r-dagger' as RecipeId,
        result: { equipmentId: 'dagger' as EquipmentId },
        requirements: [{ itemId: ore, quantity: 1 }],
      }),
      ensureEquipment({
        id: 'blade' as EquipmentId,
        name: 'Blade',
        levelRequirement: 30,
      }),
      ensureRecipe({
        id: 'r-blade' as RecipeId,
        result: { equipmentId: 'blade' as EquipmentId },
        requirements: [{ itemId: ore, quantity: 1 }],
      }),
    ]);
    seedGamestate((state) => {
      state.globalEffectSums.tradeskillsDisabled = true;
      state.globalEffectSums.regionGearDropChance = 10;
    });
    expect(
      isUnobtainableThisRun({ equipmentId: 'dagger' as EquipmentId }),
    ).toBe(false);
    expect(isUnobtainableThisRun({ equipmentId: 'blade' as EquipmentId })).toBe(
      true,
    );
  });
});

describe('gather tasks past a development cap', () => {
  it('are unavailable when the result needs a level this run cannot reach', () => {
    seed([
      ensureGathering({
        id: 'deep' as GatheringId,
        name: 'Deep',
        levels: [
          { developTime: 1, costs: [{ itemId: ore, required: 1 }] },
          { developTime: 1, costs: [{ itemId: ingot, required: 1 }] },
        ],
        gatherResults: [
          {
            chance: 1,
            levelRequirement: 2,
            items: [{ itemId: gem, quantity: 1 }],
            tradeskillIds: [],
          },
        ],
      }),
    ]);
    seedWorldNodes([{ name: 'Deep', type: 'GatherNode', mapName: 'Hills' }]);
    const gatherTask = ensureTask({
      requirement: ensureTaskRequirement({
        kind: 'GatherItem',
        nodeName: 'Deep',
        itemId: gem,
      }),
    });

    withSums(false);
    expect(isTaskUnavailableThisRun(gatherTask)).toBe(false);
    withSums(true);
    expect(isTaskUnavailableThisRun(gatherTask)).toBe(true);
  });
});

describe('materialCostDemand', () => {
  it('leaves out costs of node types removed this run', () => {
    seedGamestate();
    expect(materialCostDemand().get(ingot)).toEqual({ total: 20, largest: 20 });

    seedGamestate((state) => {
      state.globalEffectSums.removedWorldNodeTypes.Shrine = true;
    });
    expect(materialCostDemand().get(ingot)).toBeUndefined();
  });
});
