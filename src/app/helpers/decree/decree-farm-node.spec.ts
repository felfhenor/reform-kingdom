import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/kingdom/armory', () => ({
  armoryGet: vi.fn(() => []),
}));

vi.mock('@helpers/item/collectibles', () => ({
  getCollectibleQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/item/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/crafting/recipes', () => ({
  isRecipeDiscovered: vi.fn(() => false),
}));

vi.mock('@helpers/world-node/world-node-rewards', () => ({
  worldNodeCompletionRewardProgress: vi.fn(() => ({ obtained: 0, total: 0 })),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodesOfType: vi.fn(() => []),
}));

import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import {
  farmableExploreNodes,
  farmNodeRewardQuantity,
} from '@helpers/decree/decree-farm-node';
import { getCollectibleQuantity } from '@helpers/item/collectibles';
import { getMaterialQuantity } from '@helpers/item/materials';
import { armoryGet } from '@helpers/kingdom/armory';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import { worldNodesOfType } from '@helpers/world-node/world-nodes';
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

describe('farmNodeRewardQuantity', () => {
  it('reads item rewards from material storage', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(7);

    expect(farmNodeRewardQuantity({ itemId: 'bone' as ItemId })).toBe(7);
    expect(getMaterialQuantity).toHaveBeenCalledWith('bone');
  });

  it('counts owned armory entries for equipment rewards', () => {
    const cloak = 'bone-hewn-cloak' as EquipmentId;
    const owned: EquipmentItem[] = [
      {
        id: 'a' as EquipmentItemId,
        equipmentId: cloak,
        infusedItemIds: [],
        affixIds: [],
      },
      {
        id: 'b' as EquipmentItemId,
        equipmentId: 'other' as EquipmentId,
        infusedItemIds: [],
        affixIds: [],
      },
      {
        id: 'c' as EquipmentItemId,
        equipmentId: cloak,
        infusedItemIds: [],
        affixIds: [],
      },
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
