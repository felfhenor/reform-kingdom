import type {
  CollectibleContent,
  EncounterContent,
  EquipmentContent,
  GameMap,
  ItemContent,
  RecipeContent,
  TiledLayer,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import {
  worldNodeCompletionRewardProgress,
  worldNodeCompletionRewards,
  worldNodeDescription,
  worldNodeInteractionKind,
  worldNodeLabelInfo,
  worldNodeLevelLabel,
  worldNodeLevelRange,
  worldNodeMapsBuild,
  worldNodeMonsterCount,
} from '@helpers/world-nodes';

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

function buildMap(objects: {
  exploreNodes?: TiledObject[];
  otherNodes?: TiledObject[];
}): TiledMap {
  const layers: TiledLayer[] = [
    {
      id: 1,
      name: 'Explore Nodes',
      type: 'objectgroup',
      visible: true,
      objects: objects.exploreNodes ?? [],
    },
    {
      id: 2,
      name: 'Other Nodes',
      type: 'objectgroup',
      visible: true,
      objects: objects.otherNodes ?? [],
    },
  ];

  return {
    width: 50,
    height: 50,
    tilewidth: 64,
    tileheight: 64,
    tilesets: [],
    layers,
  };
}

describe('worldNodeMapsBuild', () => {
  it('converts pixel object coordinates to tile coordinates', () => {
    const kingdom = buildObject({
      name: 'Duchy of Carrina',
      type: 'Kingdom',
      x: 1536,
      y: 1600,
    });

    const maps = new Map<string, GameMap>([
      ['Carrina', { name: 'Carrina', data: buildMap({ otherNodes: [kingdom] }) }],
    ]);

    const { byPosition, byName } = worldNodeMapsBuild(maps);

    expect(byPosition['Carrina'][24][24]).toEqual({
      mapName: 'Carrina',
      x: 24,
      y: 24,
      nodeName: 'Duchy of Carrina',
      nodeData: kingdom,
    });
    expect(byName['Duchy of Carrina']).toEqual({
      mapName: 'Carrina',
      x: 24,
      y: 24,
      nodeName: 'Duchy of Carrina',
      nodeData: kingdom,
    });
  });

  it('reads objects from both node layers', () => {
    const explore = buildObject({
      id: 2,
      name: 'Forest Ruins',
      type: 'ExploreNode',
      x: 1152,
      y: 1536,
    });
    const teleport = buildObject({
      id: 3,
      name: 'To Craggled Mire',
      type: 'TeleportNode',
      x: 64,
      y: 1856,
    });

    const maps = new Map<string, GameMap>([
      [
        'Carrina',
        { name: 'Carrina', data: buildMap({
          exploreNodes: [explore],
          otherNodes: [teleport],
        }) },
      ],
    ]);

    const { byName } = worldNodeMapsBuild(maps);

    expect(byName['Forest Ruins'].nodeData.type).toBe('ExploreNode');
    expect(byName['To Craggled Mire'].nodeData.type).toBe('TeleportNode');
  });

  it('returns empty maps when there are no node layers', () => {
    const maps = new Map<string, GameMap>([
      ['Empty', { name: 'Empty', data: buildMap({}) }],
    ]);

    const { byPosition, byName } = worldNodeMapsBuild(maps);

    expect(byPosition['Empty']).toBeUndefined();
    expect(byName).toEqual({});
  });
});

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

function seedEncounter(encounter: EncounterContent): void {
  setAllIdsByName(new Map([[encounter.name, encounter.id]]));
  setAllContentById(new Map([[encounter.id, encounter]]));
}

function seedContent(
  entries: Array<{ id: string; name: string } & Record<string, unknown>>,
): void {
  setAllIdsByName(new Map(entries.map((entry) => [entry.name, entry.id])));
  setAllContentById(
    new Map(entries.map((entry) => [entry.id, entry as never])),
  );
}

describe('encounter-backed node accessors', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
  });

  describe('worldNodeLevelRange', () => {
    it("reads the level range from the matching encounter's data", () => {
      seedEncounter(buildEncounter({ levelRange: { min: 2, max: 5 } }));

      expect(worldNodeLevelRange(buildEntry())).toEqual({ min: 2, max: 5 });
    });

    it('returns undefined when there is no matching encounter', () => {
      expect(worldNodeLevelRange(buildEntry())).toBeUndefined();
    });
  });

  describe('worldNodeMonsterCount', () => {
    it('sums the monsters across every fight in the matching encounter', () => {
      seedEncounter(
        buildEncounter({
          fights: [
            { monsters: [{ monsterId: 'goblin' }] },
            {
              monsters: [{ monsterId: 'goblin' }, { monsterId: 'goblin' }],
            },
          ],
        }),
      );

      expect(worldNodeMonsterCount(buildEntry())).toBe(3);
    });

    it('returns undefined when there is no matching encounter', () => {
      expect(worldNodeMonsterCount(buildEntry())).toBeUndefined();
    });
  });

  describe('worldNodeDescription', () => {
    it("reads the description from the matching encounter's data", () => {
      seedEncounter(buildEncounter({ description: 'Crumbling stones.' }));

      expect(worldNodeDescription(buildEntry())).toBe('Crumbling stones.');
    });

    it('returns undefined when there is no matching encounter', () => {
      expect(worldNodeDescription(buildEntry())).toBeUndefined();
    });
  });

  describe('worldNodeCompletionRewards', () => {
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
          { itemId: goldCoin.id, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
          { itemId: bone.id, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
          { itemId: bone.id, min: 1, max: 1, multiplierPerLevel: 0, chance: 50 },
          { collectibleId: clam.id, chance: 50 },
        ],
      });

      // seedContent replaces the whole content map, so the encounter must be
      // seeded together with the items/collectible it references, not via a
      // separate seedEncounter() call afterward.
      seedContent([goldCoin, bone, clam, encounter]);

      expect(worldNodeCompletionRewards(buildEntry())).toEqual([
        { itemId: bone.id, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
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
        slots: ['Artifact'],
        baseStats: {} as never,
        requiredJobIds: [],
      };

      const encounter = buildEncounter({
        completionRewards: [
          { itemId: bone.id, min: 1, max: 1, multiplierPerLevel: 0, chance: 100 },
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

  describe('worldNodeLabelInfo', () => {
    it('labels a gather node with its level range', () => {
      seedEncounter(buildEncounter({ levelRange: { min: 2, max: 5 } }));

      expect(
        worldNodeLabelInfo(buildEntry({ type: 'ExploreNode' })),
      ).toEqual({ kind: 'Explore', text: 'Forest Ruins\nLv.2-5' });
    });

    it('omits the level suffix when there is no matching content', () => {
      expect(worldNodeLabelInfo(buildEntry({ type: 'TeleportNode' }))).toEqual({
        kind: 'Travel',
        text: 'Forest Ruins',
      });
    });

    it('returns undefined for non-interactable object types', () => {
      expect(worldNodeLabelInfo(buildEntry({ type: '' }))).toBeUndefined();
    });
  });
});

describe('worldNodeInteractionKind', () => {
  it.each([
    ['GatherNode', 'Gather'],
    ['ExploreNode', 'Explore'],
    ['TeleportNode', 'Travel'],
    ['Kingdom', 'Travel'],
  ] as const)('maps %s to %s', (type, kind) => {
    expect(worldNodeInteractionKind(buildEntry({ type }))).toBe(kind);
  });

  it('returns undefined for unrecognized types', () => {
    expect(worldNodeInteractionKind(buildEntry({ type: '' }))).toBeUndefined();
  });
});

describe('worldNodeLevelLabel', () => {
  it('renders min-max even when they are equal', () => {
    expect(worldNodeLevelLabel({ min: 3, max: 3 })).toBe('3-3');
  });

  it('renders the full min-max range', () => {
    expect(worldNodeLevelLabel({ min: 2, max: 5 })).toBe('2-5');
  });
});
