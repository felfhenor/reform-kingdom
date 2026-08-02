import type {
  EncounterContent,
  GameMap,
  TiledLayer,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import {
  worldNodeDescription,
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
});
