import type {
  GatheringContent,
  GatheringId,
  ItemId,
  TiledLayer,
  TiledMap,
  TiledObject,
} from '@interfaces';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/gather-node-discovery', () => ({
  isGatherNodeDiscovered: vi.fn(() => false),
}));

vi.mock('@helpers/materials', () => ({
  isMaterialDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/world-node-discovery', () => ({
  isWorldNodeDiscovered: vi.fn(() => false),
  worldNodeDiscover: vi.fn(),
}));

import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { isGatherNodeDiscovered } from '@helpers/gather-node-discovery';
import { setAllMaps } from '@helpers/maps';
import { isMaterialDiscovered } from '@helpers/materials';
import { isWorldNodeDiscovered } from '@helpers/world-node-discovery';
import {
  allGatherableMaterialIds,
  gatherableMaterialIds,
} from '@helpers/world-node-gathering';

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

describe('gatherableMaterialIds', () => {
  function buildGathering(
    overrides: Partial<GatheringContent> = {},
  ): GatheringContent {
    return {
      id: 'gather-1' as GatheringId,
      name: 'Wergen Woods',
      __type: 'gathering',
      description: 'A dry forest.',
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherTime: 10,
      gatherResults: [
        {
          chance: 100,
          items: [{ itemId: 'wood' as ItemId, quantity: 1 }],
        },
      ],
      ...overrides,
    } as GatheringContent;
  }

  it('collects materials from every discovered GatherNode across all loaded maps', () => {
    const woodGathering = buildGathering({
      id: 'gather-1' as GatheringId,
      name: 'Wergen Woods',
      gatherResults: [
        { chance: 100, items: [{ itemId: 'wood' as ItemId, quantity: 1 }] },
      ],
    });
    const stoneGathering = buildGathering({
      id: 'gather-2' as GatheringId,
      name: 'Rocky Outcrop',
      gatherResults: [
        { chance: 100, items: [{ itemId: 'stone' as ItemId, quantity: 1 }] },
      ],
    });

    setAllIdsByName(
      new Map([
        ['Wergen Woods', 'gather-1'],
        ['Rocky Outcrop', 'gather-2'],
      ]),
    );
    setAllContentById(
      new Map([
        ['gather-1', woodGathering],
        ['gather-2', stoneGathering],
      ]),
    );

    const map = buildMap({
      otherNodes: [
        buildObject({ name: 'Wergen Woods', type: 'GatherNode' }),
        buildObject({ name: 'Rocky Outcrop', type: 'GatherNode', id: 2 }),
      ],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);

    expect(gatherableMaterialIds().sort()).toEqual(['stone', 'wood']);
  });

  it('excludes GatherNodes the player has not discovered yet', () => {
    const woodGathering = buildGathering({
      id: 'gather-1' as GatheringId,
      name: 'Wergen Woods',
      gatherResults: [
        { chance: 100, items: [{ itemId: 'wood' as ItemId, quantity: 1 }] },
      ],
    });
    const stoneGathering = buildGathering({
      id: 'gather-2' as GatheringId,
      name: 'Rocky Outcrop',
      gatherResults: [
        { chance: 100, items: [{ itemId: 'stone' as ItemId, quantity: 1 }] },
      ],
    });

    setAllIdsByName(
      new Map([
        ['Wergen Woods', 'gather-1'],
        ['Rocky Outcrop', 'gather-2'],
      ]),
    );
    setAllContentById(
      new Map([
        ['gather-1', woodGathering],
        ['gather-2', stoneGathering],
      ]),
    );

    const map = buildMap({
      otherNodes: [
        buildObject({ name: 'Wergen Woods', type: 'GatherNode' }),
        buildObject({ name: 'Rocky Outcrop', type: 'GatherNode', id: 2 }),
      ],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockImplementation(
      (nodeName) => nodeName === 'Wergen Woods',
    );

    expect(gatherableMaterialIds()).toEqual(['wood']);
  });

  it('de-duplicates materials shared by multiple discovered nodes', () => {
    const gathering = buildGathering();

    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    const map = buildMap({
      otherNodes: [
        buildObject({ name: 'Wergen Woods', type: 'GatherNode', x: 0 }),
      ],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);

    expect(gatherableMaterialIds()).toEqual(['wood']);
  });

  it('returns nothing when no GatherNodes exist', () => {
    setAllMaps(new Map());

    expect(gatherableMaterialIds()).toEqual([]);
  });

  it('excludes a hidden GatherNode the player has not discovered, even if visited', () => {
    const gathering = buildGathering({ hidden: true });

    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    const map = buildMap({
      otherNodes: [buildObject({ name: 'Wergen Woods', type: 'GatherNode' })],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);

    expect(gatherableMaterialIds()).toEqual([]);
  });

  it('includes a hidden GatherNode once it has been discovered', () => {
    const gathering = buildGathering({ hidden: true });

    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    const map = buildMap({
      otherNodes: [buildObject({ name: 'Wergen Woods', type: 'GatherNode' })],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(true);

    expect(gatherableMaterialIds()).toEqual(['wood']);
  });

  it('excludes a material from a discovered node until it has actually been obtained', () => {
    const gathering = buildGathering({
      gatherResults: [
        { chance: 50, items: [{ itemId: 'wood' as ItemId, quantity: 1 }] },
        { chance: 50, items: [{ itemId: 'sap' as ItemId, quantity: 1 }] },
      ],
    });

    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    const map = buildMap({
      otherNodes: [buildObject({ name: 'Wergen Woods', type: 'GatherNode' })],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
    vi.mocked(isMaterialDiscovered).mockImplementation((id) => id === 'wood');

    expect(gatherableMaterialIds()).toEqual(['wood']);

    vi.mocked(isMaterialDiscovered).mockReturnValue(true);
  });
});

describe('allGatherableMaterialIds', () => {
  function buildGathering(
    overrides: Partial<GatheringContent> = {},
  ): GatheringContent {
    return {
      id: 'gather-1' as GatheringId,
      name: 'Wergen Woods',
      __type: 'gathering',
      description: 'A dry forest.',
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherTime: 10,
      gatherResults: [
        {
          chance: 100,
          items: [{ itemId: 'wood' as ItemId, quantity: 1 }],
        },
      ],
      ...overrides,
    } as GatheringContent;
  }

  it('includes materials from GatherNodes the player has not discovered', () => {
    const woodGathering = buildGathering();

    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', woodGathering]]));

    const map = buildMap({
      otherNodes: [buildObject({ name: 'Wergen Woods', type: 'GatherNode' })],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(false);

    expect(allGatherableMaterialIds()).toEqual(['wood']);
  });

  it('returns nothing when no GatherNodes exist', () => {
    setAllMaps(new Map());

    expect(allGatherableMaterialIds()).toEqual([]);
  });
});
