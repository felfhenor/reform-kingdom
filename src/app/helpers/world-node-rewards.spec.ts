import type {
  CollectibleContent,
  CollectibleId,
  EncounterContent,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  RecipeContent,
  RecipeId,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import {
  rewardContentInfo,
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
} from '@helpers/world-node-rewards';

function buildObject(overrides: Partial<TiledObject>): TiledObject {
  return {
    id: 1,
    name: 'Unnamed',
    type: '',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    visible: true,
    ...overrides,
  };
}

function buildEntry(nodeData: Partial<TiledObject> = {}): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 24,
    y: 24,
    nodeName: 'Forest Ruins',
    nodeData: buildObject(nodeData),
  };
}

function buildEncounter(
  overrides: Partial<EncounterContent> = {},
): EncounterContent {
  return {
    id: 'encounter-forest-ruins',
    name: 'Forest Ruins',
    __type: 'encounter',
    description: 'A crumbling ruin at the edge of the forest.',
    levelRange: { min: 1, max: 3 },
    fights: [],
    ...overrides,
  } as EncounterContent;
}

function seedContent(
  entries: Array<{ id: string; name: string } & Record<string, unknown>>,
): void {
  setAllIdsByName(new Map(entries.map((entry) => [entry.name, entry.id])));
  setAllContentById(
    new Map(entries.map((entry) => [entry.id, entry as never])),
  );
}

describe('worldNodeCompletionRewards', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
  });

  it('excludes Gold Coin and de-dupes rewards by identity', () => {
    const goldCoin: ItemContent = {
      id: 'gold-coin',
      name: 'Gold Coin',
      __type: 'item',
      description: 'Currency.',
      sprite: '0000',
      rarity: 'Common',
    };
    const bone: ItemContent = {
      id: 'bone',
      name: 'Bone',
      __type: 'item',
      description: 'A bone.',
      sprite: '0001',
      rarity: 'Common',
    };
    const clam: CollectibleContent = {
      id: 'swamp-clam',
      name: 'Swamp Clam',
      __type: 'collectible',
      description: 'A clam.',
      sprite: '0003',
      rarity: 'Uncommon',
    };

    const encounter = buildEncounter({
      completionRewards: [
        { itemId: goldCoin.id, min: 1, max: 1, chance: 100 },
        { itemId: bone.id, min: 1, max: 1, chance: 100 },
        { itemId: bone.id, min: 1, max: 1, chance: 50 },
        { collectibleId: clam.id, chance: 50 },
      ],
    });

    // seedContent replaces the whole content map, so the encounter must be
    // seeded together with the items/collectible it references, not via a
    // separate seedEncounter() call afterward.
    seedContent([goldCoin, bone, clam, encounter]);

    expect(worldNodeCompletionRewards(buildEntry())).toEqual([
      { itemId: bone.id, min: 1, max: 1, chance: 100 },
      { collectibleId: clam.id, chance: 50 },
    ]);
  });

  it('returns an empty array when there is no matching encounter', () => {
    expect(worldNodeCompletionRewards(buildEntry())).toEqual([]);
  });

  it('includes recipe rewards alongside the other reward types', () => {
    const recipe: RecipeContent = {
      id: 'equipment-bone-hewn-cloak',
      name: 'Equipment: Bone-Hewn Cloak',
      __type: 'recipe',
      result: { equipmentId: 'bone-hewn-cloak' as never },
      requirements: [],
      tradeskill: 'Tailoring',
      minTradeskillLevel: 2,
      maxTradeskillLevel: 5,
      tradeskillXP: 1,
      craftTime: 60,
    };

    const encounter = buildEncounter({
      completionRewards: [{ recipeId: recipe.id, chance: 25 }],
    });

    seedContent([recipe, encounter]);

    expect(worldNodeCompletionRewards(buildEntry())).toEqual([
      { recipeId: recipe.id, chance: 25 },
    ]);
  });
});

describe('worldNodeCompletionRewardProgress', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
  });

  it('reports 0/total when nothing has been discovered yet', () => {
    const bone: ItemContent = {
      id: 'bone',
      name: 'Bone',
      __type: 'item',
      description: 'A bone.',
      sprite: '0001',
      rarity: 'Common',
    };
    const equipment: EquipmentContent = {
      id: 'goblin-skull',
      name: 'Goblin Skull',
      __type: 'equipment',
      description: 'A skull.',
      sprite: '0000',
      rarity: 'Common',
      levelRequirement: 1,
      type: 'Artifact',
      baseStats: {} as never,
    };

    const encounter = buildEncounter({
      completionRewards: [
        { itemId: bone.id, min: 1, max: 1, chance: 100 },
        { equipmentId: equipment.id, chance: 10 },
      ],
    });

    seedContent([bone, equipment, encounter]);

    expect(worldNodeCompletionRewardProgress(buildEntry())).toEqual({
      obtained: 0,
      total: 2,
    });
  });

  it('reports 0/0 when there is no matching encounter', () => {
    expect(worldNodeCompletionRewardProgress(buildEntry())).toEqual({
      obtained: 0,
      total: 0,
    });
  });
});

describe('rewardContentInfo', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
  });

  it('resolves an item reward', () => {
    const bone: ItemContent = {
      id: 'bone' as ItemId,
      name: 'Bone',
      __type: 'item',
      description: 'A bone.',
      sprite: '0001',
      rarity: 'Common',
    };
    seedContent([bone]);

    expect(rewardContentInfo({ itemId: bone.id })).toEqual({
      name: 'Bone',
      sprite: '0001',
      spritesheet: 'item',
    });
  });

  it('resolves an equipment reward', () => {
    const cloak: EquipmentContent = {
      id: 'bone-hewn-cloak' as EquipmentId,
      name: 'Bone-Hewn Cloak',
      __type: 'equipment',
      description: 'A cloak.',
      sprite: '0002',
      rarity: 'Uncommon',
      levelRequirement: 3,
      type: 'Artifact',
      baseStats: {} as never,
      slots: 1,
      grantedSkillIds: [],
    };
    seedContent([cloak]);

    expect(rewardContentInfo({ equipmentId: cloak.id })).toEqual({
      name: 'Bone-Hewn Cloak',
      sprite: '0002',
      spritesheet: 'equipment',
    });
  });

  it('resolves a collectible reward', () => {
    const clam: CollectibleContent = {
      id: 'swamp-clam' as CollectibleId,
      name: 'Swamp Clam',
      __type: 'collectible',
      description: 'A clam.',
      sprite: '0003',
      rarity: 'Uncommon',
    };
    seedContent([clam]);

    expect(rewardContentInfo({ collectibleId: clam.id })).toEqual({
      name: 'Swamp Clam',
      sprite: '0003',
      spritesheet: 'collectible',
    });
  });

  it("resolves a recipe reward using the recipe's own name, but the crafted result's icon", () => {
    const cloak: EquipmentContent = {
      id: 'bone-hewn-cloak' as EquipmentId,
      name: 'Bone-Hewn Cloak',
      __type: 'equipment',
      description: 'A cloak.',
      sprite: '0002',
      rarity: 'Uncommon',
      levelRequirement: 3,
      type: 'Artifact',
      baseStats: {} as never,
      slots: 1,
      grantedSkillIds: [],
    };
    const recipe: RecipeContent = {
      id: 'equipment-bone-hewn-cloak' as RecipeId,
      name: 'Equipment: Bone-Hewn Cloak',
      __type: 'recipe',
      result: { equipmentId: cloak.id },
      requirements: [],
      tradeskill: 'Tailoring',
      minTradeskillLevel: 2,
      maxTradeskillLevel: 5,
      tradeskillXP: 1,
      craftTime: 60,
    };
    seedContent([cloak, recipe]);

    expect(rewardContentInfo({ recipeId: recipe.id })).toEqual({
      name: 'Equipment: Bone-Hewn Cloak',
      sprite: '0002',
      spritesheet: 'equipment',
    });
  });

  it('returns undefined when the reward has no matching content', () => {
    expect(rewardContentInfo({ itemId: 'unknown' as ItemId })).toBeUndefined();
  });
});
