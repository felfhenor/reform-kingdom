import type {
  GatherResult,
  GatheringContent,
  GatheringId,
  ItemId,
  TiledObject,
  WorldNodeEntry,
} from '@interfaces';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 0),
}));

import { setAllContentById, setAllIdsByName } from '@helpers/content/content';
import { worldNodeLevel } from '@helpers/world-node/world-node-level';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';

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
      buildResult({ items: [{ itemId: 'wood' as ItemId, quantity: 1 }] }),
    ],
    ...overrides,
  } as GatheringContent;
}

function buildResult(overrides: Partial<GatherResult>): GatherResult {
  return {
    chance: 100,
    items: [],
    tradeskillIds: [],
    ...overrides,
  };
}

function buildEntry(nodeName: string): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 0,
    y: 0,
    nodeName,
    nodeData: {} as TiledObject,
  };
}

describe('worldNodeGatherMaterialIds', () => {
  it('collects the item ids from every gather result at the node current level', () => {
    const gathering = buildGathering({
      gatherResults: [
        buildResult({ items: [{ itemId: 'wood' as ItemId, quantity: 1 }] }),
        buildResult({
          chance: 50,
          items: [{ itemId: 'sap' as ItemId, quantity: 1 }],
        }),
      ],
    });
    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    expect(
      worldNodeGatherMaterialIds(buildEntry('Wergen Woods')).sort(),
    ).toEqual(['sap', 'wood']);
  });

  it('de-duplicates an item id shared by multiple gather results', () => {
    const gathering = buildGathering({
      gatherResults: [
        buildResult({
          chance: 50,
          items: [{ itemId: 'wood' as ItemId, quantity: 1 }],
        }),
        buildResult({
          chance: 50,
          items: [{ itemId: 'wood' as ItemId, quantity: 2 }],
        }),
      ],
    });
    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));

    expect(worldNodeGatherMaterialIds(buildEntry('Wergen Woods'))).toEqual([
      'wood',
    ]);
  });

  it('excludes a level-gated result until the node is developed to that level', () => {
    const gathering = buildGathering({
      gatherResults: [
        buildResult({
          chance: 50,
          items: [{ itemId: 'wood' as ItemId, quantity: 1 }],
        }),
        buildResult({
          chance: 50,
          items: [{ itemId: 'azurite' as ItemId, quantity: 1 }],
          levelRequirement: 2,
        }),
      ],
    });
    setAllIdsByName(new Map([['Wergen Woods', 'gather-1']]));
    setAllContentById(new Map([['gather-1', gathering]]));
    vi.mocked(worldNodeLevel).mockReturnValue(0);

    expect(
      worldNodeGatherMaterialIds(buildEntry('Wergen Woods')).sort(),
    ).toEqual(['wood']);

    vi.mocked(worldNodeLevel).mockReturnValue(2);

    expect(
      worldNodeGatherMaterialIds(buildEntry('Wergen Woods')).sort(),
    ).toEqual(['azurite', 'wood']);

    vi.mocked(worldNodeLevel).mockReturnValue(0);
  });

  it('returns nothing when the node is not a gathering node', () => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());

    expect(worldNodeGatherMaterialIds(buildEntry('Not A Node'))).toEqual([]);
  });
});
