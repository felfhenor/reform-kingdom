import type {
  EncounterContent,
  NodeOverrideContent,
  NodeOverrideId,
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledTileset,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it } from 'vitest';

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { setAllMaps } from '@helpers/maps';
import {
  worldNodeDescription,
  worldNodeSpriteFrame,
} from '@helpers/world-node/world-node-content';

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

function buildNodeOverride(
  overrides: Partial<NodeOverrideContent> = {},
): NodeOverrideContent {
  return {
    id: 'override-forest-ruins' as NodeOverrideId,
    name: 'Forest Ruins',
    __type: 'nodeoverride',
    description: 'A hand-authored blurb for this node.',
    ...overrides,
  };
}

describe('worldNodeDescription', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
  });

  it("reads the description from the matching encounter's data", () => {
    seedEncounter(buildEncounter({ description: 'Crumbling stones.' }));

    expect(worldNodeDescription(buildEntry())).toBe('Crumbling stones.');
  });

  it('reads the description from a node override (e.g. a Kingdom node with no encounter/gathering data)', () => {
    seedContent([buildNodeOverride({ description: 'The town square.' })]);

    expect(worldNodeDescription(buildEntry())).toBe('The town square.');
  });

  it('returns undefined when there is no matching encounter or override', () => {
    expect(worldNodeDescription(buildEntry())).toBeUndefined();
  });
});

function buildTileset(overrides: Partial<TiledTileset> = {}): TiledTileset {
  return {
    firstgid: 1,
    name: 'terrain',
    image: '../mapdata/maptiles.png',
    imagewidth: 1600,
    imageheight: 1088,
    columns: 25,
    tilewidth: 64,
    tileheight: 64,
    margin: 0,
    spacing: 0,
    tilecount: 425,
    ...overrides,
  };
}

describe('worldNodeSpriteFrame', () => {
  it("resolves the entry's map tile via its object gid", () => {
    const map = buildMap({});
    map.tilesets = [buildTileset()];
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));

    expect(worldNodeSpriteFrame(buildEntry({ gid: 26 }))).toEqual({
      imagePath: 'mapdata/maptiles.png',
      imageWidth: 1600,
      imageHeight: 1088,
      x: 0,
      y: 64,
      width: 64,
      height: 64,
    });
  });

  it('returns undefined when the map no longer exists', () => {
    setAllMaps(new Map());

    expect(worldNodeSpriteFrame(buildEntry({ gid: 26 }))).toBeUndefined();
  });
});
