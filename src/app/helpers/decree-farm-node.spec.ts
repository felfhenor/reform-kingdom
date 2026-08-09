import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/collectibles', () => ({
  getCollectibleQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/recipes', () => ({
  isRecipeDiscovered: vi.fn(() => false),
}));

vi.mock('@helpers/world-nodes', () => ({
  rewardContentInfo: vi.fn(),
  rewardKey: vi.fn(),
  worldNodeByName: vi.fn(),
  worldNodeCompletionRewardProgress: vi.fn(() => ({ obtained: 0, total: 0 })),
  worldNodeCompletionRewards: vi.fn(() => []),
  worldNodeLevelLabel: vi.fn(),
  worldNodeLevelRange: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

import { armoryGet } from '@helpers/armory';
import { getCollectibleQuantity } from '@helpers/collectibles';
import {
  exploreNodeFarmOptions,
  farmableExploreNodes,
  farmNodeRewardOptions,
  farmNodeRewardQuantity,
} from '@helpers/decree-farm-node';
import { getMaterialQuantity } from '@helpers/materials';
import { isRecipeDiscovered } from '@helpers/recipes';
import {
  rewardContentInfo,
  rewardKey,
  worldNodeByName,
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
  worldNodeLevelLabel,
  worldNodeLevelRange,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  ItemId,
  WorldNodeEntry,
} from '@interfaces';

function buildNode(nodeName: string): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 0,
    y: 0,
    nodeName,
    nodeData: { type: 'ExploreNode' } as never,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(armoryGet).mockReturnValue([]);
  vi.mocked(getCollectibleQuantity).mockReturnValue(0);
  vi.mocked(getMaterialQuantity).mockReturnValue(0);
  vi.mocked(isRecipeDiscovered).mockReturnValue(false);
  vi.mocked(worldNodesOfType).mockReturnValue([]);
  vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
    obtained: 0,
    total: 0,
  });
  vi.mocked(worldNodeCompletionRewards).mockReturnValue([]);
  vi.mocked(worldNodeByName).mockReturnValue(undefined);
  vi.mocked(rewardKey).mockImplementation((reward) => {
    if ('itemId' in reward) return `item:${reward.itemId}`;
    if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
    if ('collectibleId' in reward) return `collectible:${reward.collectibleId}`;
    return `recipe:${reward.recipeId}`;
  });
});

describe('farmableExploreNodes', () => {
  it('only includes ExploreNodes with at least one obtained reward', () => {
    const beaten = buildNode('Beaten');
    const untouched = buildNode('Untouched');
    vi.mocked(worldNodesOfType).mockReturnValue([beaten, untouched]);
    vi.mocked(worldNodeCompletionRewardProgress).mockImplementation((entry) =>
      entry.nodeName === 'Beaten'
        ? { obtained: 1, total: 2 }
        : { obtained: 0, total: 2 },
    );

    expect(farmableExploreNodes()).toEqual([beaten]);
  });
});

describe('exploreNodeFarmOptions', () => {
  it('maps farmable nodes to sorted options carrying the level label and the raw entry', () => {
    const zebra = buildNode('Zebra Ruins');
    const alpha = buildNode('Alpha Ruins');
    vi.mocked(worldNodesOfType).mockReturnValue([zebra, alpha]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 1,
      total: 1,
    });
    vi.mocked(worldNodeLevelRange).mockImplementation((entry) =>
      entry.nodeName === 'Zebra Ruins' ? { min: 5, max: 10 } : undefined,
    );
    vi.mocked(worldNodeLevelLabel).mockReturnValue('5-10');

    expect(exploreNodeFarmOptions()).toEqual([
      { nodeName: 'Alpha Ruins', levelLabel: '?', entry: alpha },
      { nodeName: 'Zebra Ruins', levelLabel: '5-10', entry: zebra },
    ]);
  });
});

describe('farmNodeRewardOptions', () => {
  it('returns an empty list when the node does not exist', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(farmNodeRewardOptions('Nowhere')).toEqual([]);
  });

  it('resolves each completion reward to a keyed display option, stripping odds fields', () => {
    const entry = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(entry);
    vi.mocked(worldNodeCompletionRewards).mockReturnValue([
      { itemId: 'bone' as ItemId, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
    ]);
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Bone',
      sprite: '0001',
      spritesheet: 'item',
    });

    expect(farmNodeRewardOptions('Forest Ruins')).toEqual([
      {
        name: 'Bone',
        sprite: '0001',
        spritesheet: 'item',
        key: 'item:bone',
        reward: { itemId: 'bone' },
      },
    ]);
  });

  it('omits rewards that fail to resolve to content', () => {
    const entry = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(entry);
    vi.mocked(worldNodeCompletionRewards).mockReturnValue([
      { itemId: 'unknown' as ItemId, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
    ]);
    vi.mocked(rewardContentInfo).mockReturnValue(undefined);

    expect(farmNodeRewardOptions('Forest Ruins')).toEqual([]);
  });

  it('excludes recipe rewards - a recipe can only ever drop once, so it is never farmable', () => {
    const entry = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(entry);
    vi.mocked(worldNodeCompletionRewards).mockReturnValue([
      { recipeId: 'equipment-cloak' as never, chance: 25 },
      { itemId: 'bone' as ItemId, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
    ]);
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Bone',
      sprite: '0001',
      spritesheet: 'item',
    });

    const options = farmNodeRewardOptions('Forest Ruins');

    expect(options).toHaveLength(1);
    expect(options[0].reward).toEqual({ itemId: 'bone' });
    expect(rewardContentInfo).toHaveBeenCalledTimes(1);
  });
});

describe('farmNodeRewardQuantity', () => {
  it('reads item rewards from material storage', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(7);

    expect(farmNodeRewardQuantity({ itemId: 'bone' as ItemId })).toBe(7);
    expect(getMaterialQuantity).toHaveBeenCalledWith('bone');
  });

  it('counts owned armory entries for equipment rewards', () => {
    const cloak = 'bone-hewn-cloak' as EquipmentId;
    const owned: EquipmentItem[] = [
      { id: 'a' as EquipmentItemId, equipmentId: cloak, infusedItemIds: [] },
      {
        id: 'b' as EquipmentItemId,
        equipmentId: 'other' as EquipmentId,
        infusedItemIds: [],
      },
      { id: 'c' as EquipmentItemId, equipmentId: cloak, infusedItemIds: [] },
    ];
    vi.mocked(armoryGet).mockReturnValue(owned);

    expect(farmNodeRewardQuantity({ equipmentId: cloak })).toBe(2);
  });

  it('reads collectible rewards from collectible storage', () => {
    vi.mocked(getCollectibleQuantity).mockReturnValue(3);

    expect(
      farmNodeRewardQuantity({ collectibleId: 'swamp-clam' as never }),
    ).toBe(3);
  });

  it('reads a recipe reward as 1 once discovered and 0 otherwise', () => {
    vi.mocked(isRecipeDiscovered).mockReturnValue(false);
    expect(
      farmNodeRewardQuantity({ recipeId: 'equipment-cloak' as never }),
    ).toBe(0);

    vi.mocked(isRecipeDiscovered).mockReturnValue(true);
    expect(
      farmNodeRewardQuantity({ recipeId: 'equipment-cloak' as never }),
    ).toBe(1);
  });
});
