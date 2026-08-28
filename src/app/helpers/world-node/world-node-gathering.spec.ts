import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { setAllMaps } from '@helpers/maps';
import {
  allGatherableMaterialIds,
  gatheringResultsAtLevel,
} from '@helpers/world-node/world-node-gathering';
import type {
  GatheringContent,
  GatheringId,
  ItemId,
  TiledLayer,
  TiledMap,
  TiledObject,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

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

describe('gatheringResultsAtLevel', () => {
  function buildGathering(
    overrides: Partial<GatheringContent> = {},
  ): GatheringContent {
    return {
      id: 'gather-1' as GatheringId,
      name: 'Carrina Copper Mines',
      __type: 'gathering',
      description: 'A small copper mine.',
      levelRange: { min: 1, max: 5 },
      xpGainedIfInLevelRange: 3,
      gatherTime: 10,
      gatherResults: [],
      ...overrides,
    } as GatheringContent;
  }

  it('always includes results with no levelRequirement, regardless of level', () => {
    const unrestricted = {
      chance: 40,
      items: [{ itemId: 'wood' as ItemId, quantity: 1 }],
    };
    const gathering = buildGathering({ gatherResults: [unrestricted] });

    expect(gatheringResultsAtLevel(gathering, 0)).toEqual([unrestricted]);
    expect(gatheringResultsAtLevel(gathering, 3)).toEqual([unrestricted]);
  });

  it('only includes a level-gated result at its exact level, not earlier or later ones', () => {
    const levelOne = {
      chance: 7,
      items: [{ itemId: 'ore' as ItemId, quantity: 1 }],
      levelRequirement: 0,
    };
    const levelTwo = {
      chance: 4,
      items: [{ itemId: 'azurite' as ItemId, quantity: 1 }],
      levelRequirement: 1,
    };
    const gathering = buildGathering({ gatherResults: [levelOne, levelTwo] });

    expect(gatheringResultsAtLevel(gathering, 0)).toEqual([levelOne]);
    expect(gatheringResultsAtLevel(gathering, 1)).toEqual([levelTwo]);
    expect(gatheringResultsAtLevel(gathering, 2)).toEqual([]);
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

    expect(allGatherableMaterialIds()).toEqual(['wood']);
  });

  it('returns nothing when no GatherNodes exist', () => {
    setAllMaps(new Map());

    expect(allGatherableMaterialIds()).toEqual([]);
  });

  it("includes a level-gated material regardless of the node's current development level - pruneInvalidDecreeGatherClauses relies on this to not delete a clause for a material that is just not unlocked yet", () => {
    const gathering = buildGathering({
      gatherResults: [
        { chance: 50, items: [{ itemId: 'wood' as ItemId, quantity: 1 }] },
        {
          chance: 50,
          items: [{ itemId: 'azurite' as ItemId, quantity: 1 }],
          levelRequirement: 3,
        },
      ],
    });

    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    const map = buildMap({
      otherNodes: [buildObject({ name: 'Wergen Woods', type: 'GatherNode' })],
    });
    setAllMaps(new Map([['Carrina', { name: 'Carrina', data: map }]]));

    expect(allGatherableMaterialIds().sort()).toEqual(['azurite', 'wood']);
  });
});
