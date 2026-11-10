import { beforeEach, describe, expect, it } from 'vitest';

import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureMonster } from '@helpers/content/ensure-monster';
import {
  isFoundOnlyAtRemovedNodes,
  itemSources,
} from '@helpers/kingdom/museum';
import {
  regionGatheringDrops,
  worldNodeMonsterDropTable,
} from '@helpers/world-node/world-node-monster-drops';
import type {
  EncounterId,
  GatheringId,
  ItemId,
  MonsterId,
  WorldNodeEntry,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const stick = 'stick' as ItemId;
const wood = 'wood' as ItemId;
const hide = 'hide' as ItemId;
const ore = 'ore' as ItemId;
const teeth = 'teeth' as ItemId;

const woods = ensureGathering({
  id: 'woods' as GatheringId,
  name: 'Woods',
  levels: [
    { developTime: 1, costs: [] },
    { developTime: 1, costs: [] },
  ],
  gatherResults: [
    {
      chance: 5,
      levelRequirement: 0,
      items: [{ itemId: stick, quantity: 1 }],
      tradeskillIds: [],
    },
    {
      chance: 3,
      levelRequirement: 2,
      items: [{ itemId: wood, quantity: 2 }],
      tradeskillIds: [],
    },
    {
      chance: 1,
      levelRequirement: 2,
      items: [{ itemId: hide, quantity: 1 }],
      tradeskillIds: [],
    },
  ],
});
const mine = ensureGathering({
  id: 'mine' as GatheringId,
  name: 'Mine',
  gatherResults: [
    { chance: 1, items: [{ itemId: ore, quantity: 1 }], tradeskillIds: [] },
  ],
});

let den: WorldNodeEntry;

function withDropChance(chance: number): void {
  seedGamestate((state) => {
    state.globalEffectSums.regionGatheringDropChance = chance;
    state.globalEffectSums.removedWorldNodeTypes.GatherNode = chance > 0;
  });
}

beforeEach(() => {
  seedContent([
    woods,
    mine,
    ensureMonster({
      id: 'goblin' as MonsterId,
      name: 'Goblin',
      drops: [ensureDroppedReward({ itemId: teeth, chance: 50 })],
    }),
    ensureEncounter({
      id: 'den' as EncounterId,
      name: 'Den',
      levelRange: { min: 1, max: 5 },
      fights: [{ monsters: [{ monsterId: 'goblin' as MonsterId }] }],
    }),
  ]);
  den = seedWorldNodes([
    { name: 'Woods', type: 'GatherNode', mapName: 'Forest' },
    { name: 'Den', type: 'ExploreNode', mapName: 'Forest' },
    { name: 'Mine', type: 'GatherNode', mapName: 'Hills' },
  ])['Den'];
});

describe('regionGatheringDrops', () => {
  it('is empty while no effect grants it', () => {
    withDropChance(0);
    expect(regionGatheringDrops('Forest')).toEqual([]);
  });

  it("splits the chance by weight across the map's max-level gather results", () => {
    withDropChance(40);

    expect(
      regionGatheringDrops('Forest').map(({ itemId, chance, min, max }) => ({
        itemId,
        chance,
        min,
        max,
      })),
    ).toEqual([
      { itemId: wood, chance: 30, min: 2, max: 2 },
      { itemId: hide, chance: 10, min: 1, max: 1 },
    ]);
  });
});

describe('worldNodeMonsterDropTable', () => {
  it("adds the node's region gathering drops to its monsters' own, unless left out for NPC towns", () => {
    withDropChance(0);
    expect(
      worldNodeMonsterDropTable(den, true).map((drop) =>
        drop.kind === 'Item' ? drop.itemId : undefined,
      ),
    ).toEqual([teeth]);

    withDropChance(40);
    const itemIds = (withRegionDrops: boolean) =>
      worldNodeMonsterDropTable(den, withRegionDrops).map((drop) =>
        drop.kind === 'Item' ? drop.itemId : undefined,
      );
    expect(itemIds(true)).toEqual([teeth, wood, hide]);
    expect(itemIds(false)).toEqual([teeth]);
  });
});

describe('museum sources for region gathering drops', () => {
  it("names the map's fights, so a removed gather node's materials still count", () => {
    seedGamestate((state) => {
      state.globalEffectSums.removedWorldNodeTypes.GatherNode = true;
    });
    expect(isFoundOnlyAtRemovedNodes({ itemId: wood })).toBe(true);

    withDropChance(40);
    expect(itemSources(wood)).toEqual([{ type: 'node', name: 'Den' }]);
    expect(isFoundOnlyAtRemovedNodes({ itemId: wood })).toBe(false);
    expect(isFoundOnlyAtRemovedNodes({ itemId: ore })).toBe(true);
  });
});
