import type {
  EncounterContent,
  GameMap,
  NodeOverrideContent,
  NodeOverrideId,
  TiledLayer,
  TiledMap,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/world-node/world-node-discovery', () => ({
  isWorldNodeDiscovered: vi.fn(() => false),
  worldNodeDiscover: vi.fn(),
}));

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { setAllMaps } from '@helpers/maps';
import { isWorldNodeDiscovered } from '@helpers/world-node/world-node-discovery';
import {
  isWorldNodeHidden,
  isWorldNodeVisible,
  worldNodeDisplayName,
  worldNodeMapsBuild,
  worldNodeOverride,
} from '@helpers/world-node/world-nodes';

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
      [
        'Carrina',
        { name: 'Carrina', data: buildMap({ otherNodes: [kingdom] }) },
      ],
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
        {
          name: 'Carrina',
          data: buildMap({
            exploreNodes: [explore],
            otherNodes: [teleport],
          }),
        },
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

describe('encounter-backed node accessors', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);
  });

  describe('isWorldNodeHidden', () => {
    it('is true when the matching encounter is authored hidden', () => {
      seedEncounter(buildEncounter({ hidden: true }));

      expect(isWorldNodeHidden(buildEntry())).toBe(true);
    });

    it('is false when the matching encounter is not hidden', () => {
      seedEncounter(buildEncounter({ hidden: false }));

      expect(isWorldNodeHidden(buildEntry())).toBe(false);
    });

    it('is false when there is no matching content', () => {
      expect(isWorldNodeHidden(buildEntry())).toBe(false);
    });
  });

  describe('isWorldNodeVisible', () => {
    it('is true for a non-hidden node', () => {
      seedEncounter(buildEncounter({ hidden: false }));

      expect(isWorldNodeVisible(buildEntry())).toBe(true);
    });

    it('is false for a hidden node that has not been discovered', () => {
      seedEncounter(buildEncounter({ hidden: true }));
      vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);

      expect(isWorldNodeVisible(buildEntry())).toBe(false);
    });

    it('is true for a hidden node that has been discovered', () => {
      seedEncounter(buildEncounter({ hidden: true }));
      vi.mocked(isWorldNodeDiscovered).mockReturnValue(true);

      expect(isWorldNodeVisible(buildEntry())).toBe(true);
    });
  });

  describe('worldNodeOverride', () => {
    it('reads the matching node override', () => {
      seedContent([
        buildNodeOverride({ description: 'A hand-authored blurb.' }),
      ]);

      expect(worldNodeOverride(buildEntry())?.description).toBe(
        'A hand-authored blurb.',
      );
    });

    it('returns undefined when there is no matching override', () => {
      expect(worldNodeOverride(buildEntry())).toBeUndefined();
    });
  });
});

describe('worldNodeDisplayName', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
  });

  it('returns the real name for a visible node', () => {
    seedEncounter(buildEncounter({ hidden: false }));
    const map = buildMap({
      exploreNodes: [
        buildObject({ name: 'Forest Ruins', type: 'ExploreNode' }),
      ],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));

    expect(worldNodeDisplayName('Forest Ruins')).toBe('Forest Ruins');
  });

  it('masks a hidden, undiscovered node as "???"', () => {
    seedEncounter(buildEncounter({ hidden: true }));
    const map = buildMap({
      exploreNodes: [
        buildObject({ name: 'Forest Ruins', type: 'ExploreNode' }),
      ],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);

    expect(worldNodeDisplayName('Forest Ruins')).toBe('???');
  });

  it('returns the real name for a hidden node once discovered', () => {
    seedEncounter(buildEncounter({ hidden: true }));
    const map = buildMap({
      exploreNodes: [
        buildObject({ name: 'Forest Ruins', type: 'ExploreNode' }),
      ],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(true);

    expect(worldNodeDisplayName('Forest Ruins')).toBe('Forest Ruins');
  });

  it('falls back to the raw name when the node no longer resolves', () => {
    setAllMaps(new Map());

    expect(worldNodeDisplayName('Ghost Node')).toBe('Ghost Node');
  });
});
