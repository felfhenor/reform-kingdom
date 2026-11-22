import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  equipmentHomeGear,
  equipmentHomeMapsBuild,
} from '@helpers/item/equipment-home-map';
import type {
  EncounterId,
  EquipmentId,
  GatheringId,
  ItemId,
  MonsterId,
  RecipeId,
  RecipeRequirement,
  TownId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedWorldNodes } from '@/testing/world';

const ore = 'ore' as ItemId;
const silk = 'silk' as ItemId;
const mithril = 'mithril' as ItemId;
const ingot = 'ingot' as ItemId;
const shopCloth = 'shopCloth' as ItemId;
const loopA = 'loopA' as ItemId;
const loopB = 'loopB' as ItemId;
const fang = 'fang' as ItemId;

function gearRecipe(
  id: string,
  equipmentId: string,
  requirements: RecipeRequirement[],
) {
  return ensureRecipe({
    id: id as RecipeId,
    result: { equipmentId: equipmentId as EquipmentId },
    requirements,
  });
}

function itemRecipe(id: string, itemId: ItemId, from: ItemId) {
  return ensureRecipe({
    id: id as RecipeId,
    result: { itemId, quantity: 1 },
    requirements: [{ itemId: from, quantity: 1 }],
  });
}

function gear(id: string, levelRequirement: number, unobtainable = false) {
  return ensureEquipment({
    id: id as EquipmentId,
    name: id,
    levelRequirement,
    unobtainable,
  });
}

function gatherAt(id: string, min: number, itemIds: ItemId[]) {
  return ensureGathering({
    id: id as GatheringId,
    name: id,
    levelRange: { min, max: min + 5 },
    gatherResults: itemIds.map((itemId) => ({
      chance: 1,
      items: [{ itemId, quantity: 1 }],
      tradeskillIds: [],
    })),
  });
}

beforeEach(() => {
  seedContent([
    gatherAt('EarlyMine', 1, [ore, loopA]),
    // Silk is also gathered late, but a goblin drops it early.
    gatherAt('LateMine', 30, [mithril, silk, fang]),
    ensureMonster({
      id: 'goblin' as MonsterId,
      name: 'Goblin',
      drops: [
        ensureDroppedReward({ itemId: silk, chance: 10 }),
        ensureDroppedReward({ itemId: fang, chance: 10, minLevel: 40 }),
        ensureDroppedReward({ itemId: mithril, chance: 10, maxLevel: 0 }),
      ],
    }),
    ensureEncounter({
      id: 'den' as EncounterId,
      name: 'EarlyDen',
      levelRange: { min: 2, max: 60 },
      fights: [{ monsters: [{ monsterId: 'goblin' as MonsterId }] }],
    }),
    itemRecipe('smelt', ingot, ore),
    itemRecipe('loopA', loopA, loopB),
    itemRecipe('loopB', loopB, loopA),
    gear('dagger', 3),
    gearRecipe('r-dagger', 'dagger', [{ itemId: ingot, quantity: 1 }]),
    gear('robe', 5),
    gearRecipe('r-robe', 'robe', [
      { itemId: ingot, quantity: 1 },
      { itemId: silk, quantity: 1 },
    ]),
    gear('daggerPlus', 6),
    gearRecipe('r-daggerPlus', 'daggerPlus', [
      { equipmentId: 'dagger' as EquipmentId },
    ]),
    gear('blade', 32),
    gearRecipe('r-blade', 'blade', [
      { itemId: ingot, quantity: 1 },
      { itemId: mithril, quantity: 1 },
    ]),
    gear('townStaff', 31),
    gearRecipe('r-townStaff', 'townStaff', [{ itemId: mithril, quantity: 1 }]),
    ensureTown({
      id: 'town' as TownId,
      name: 'Town',
      crafting: { uniqueRecipeIds: ['r-townStaff' as RecipeId] },
    }),
    gear('hat', 4),
    gearRecipe('r-hat', 'hat', [{ itemId: shopCloth, quantity: 1 }]),
    gear('loopGear', 4),
    gearRecipe('r-loopGear', 'loopGear', [{ itemId: loopA, quantity: 1 }]),
    // Resolved after loopGear, so loopB must not have been cached mid-cycle.
    gear('loopBGear', 4),
    gearRecipe('r-loopBGear', 'loopBGear', [{ itemId: loopB, quantity: 1 }]),
    gear('cheapRing', 25),
    gearRecipe('r-cheapRing-late', 'cheapRing', [
      { itemId: mithril, quantity: 1 },
    ]),
    gearRecipe('r-cheapRing-early', 'cheapRing', [
      { itemId: ore, quantity: 1 },
    ]),
    gear('fangCharm', 30),
    gearRecipe('r-fangCharm', 'fangCharm', [{ itemId: fang, quantity: 1 }]),
    gear('relic', 3, true),
    gearRecipe('r-relic', 'relic', [{ itemId: ore, quantity: 1 }]),
  ]);
  seedWorldNodes([
    { name: 'EarlyMine', type: 'GatherNode', mapName: 'Early' },
    { name: 'EarlyDen', type: 'ExploreNode', mapName: 'Early' },
    { name: 'LateMine', type: 'GatherNode', mapName: 'Late' },
  ]);
});

describe('equipmentHomeMapsBuild', () => {
  it("homes gear on its latest ingredient's earliest map", () => {
    expect(Object.fromEntries(equipmentHomeMapsBuild())).toEqual({
      dagger: 'Early',
      robe: 'Early',
      daggerPlus: 'Early',
      blade: 'Late',
      cheapRing: 'Early',
      fangCharm: 'Late',
      loopGear: 'Early',
      loopBGear: 'Early',
    });
  });
});

describe('equipmentHomeGear', () => {
  it('lists the gear homed on a map', () => {
    expect(equipmentHomeGear('Late').map((equipment) => equipment.id)).toEqual([
      'blade',
      'fangCharm',
    ]);
    expect(equipmentHomeGear('Nowhere')).toEqual([]);
  });
});
