import type {
  CaravanContent,
  CaravanId,
  EncounterContent,
  GameMap,
  NodeOverrideContent,
  NodeOverrideId,
  TiledLayer,
  TiledMap,
  TiledObject,
  TownContent,
  TrainerContent,
  TrainerId,
  TownId,
  WorldNodeEntry,
  CollectibleId,
  EncounterId,
  TownContentInput,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

import { ensureCaravan } from '@helpers/content/ensure-caravan';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureNodeOverride } from '@helpers/content/ensure-nodeoverride';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTrainer } from '@helpers/content/ensure-trainer';
import { seedContent } from '@/testing/content';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';
import {
  isWorldNodeCollectibleGateMet,
  isWorldNodeHidden,
  isWorldNodeMapVisited,
  isWorldNodeVisible,
  worldNodeDisplayName,
  worldNodeMapsBuild,
  worldNodeOverride,
  worldNodeTown,
  worldNodeTrainer,
} from '@helpers/world-node/world-nodes';

function found({
  node = false,
  collectibles = [],
}: { node?: boolean; collectibles?: string[] } = {}): void {
  seedGamestate((state) => {
    if (node) state.worldDiscoveries['Forest Ruins'] = { foundAt: 1 };
    collectibles.forEach((id) =>
      applyCollectibleGrant(state, id as CollectibleId, 1),
    );
  });
}

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

function buildMap(objects: { exploreNodes?: TiledObject[] }): TiledMap {
  const layers: TiledLayer[] = [
    {
      id: 1,
      name: 'Explore Nodes',
      type: 'objectgroup',
      visible: true,
      objects: objects.exploreNodes ?? [],
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
        { name: 'Carrina', data: buildMap({ exploreNodes: [kingdom] }) },
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

  it('reads every node type from the Explore Nodes layer', () => {
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
            exploreNodes: [explore, teleport],
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

function buildEntry(): WorldNodeEntry {
  return seedWorldNodes([{ name: 'Forest Ruins', type: 'ExploreNode' }])[
    'Forest Ruins'
  ];
}

function buildEncounter(
  overrides: Partial<EncounterContent> = {},
): EncounterContent {
  return ensureEncounter({
    id: 'encounter-forest-ruins' as EncounterId,
    name: 'Forest Ruins',
    levelRange: { min: 1, max: 3 },
    ...overrides,
  });
}

function buildNodeOverride(
  overrides: Partial<NodeOverrideContent> = {},
): NodeOverrideContent {
  return ensureNodeOverride({
    id: 'override-forest-ruins' as NodeOverrideId,
    name: 'Forest Ruins',
    ...overrides,
  });
}

function buildCaravan(overrides: Partial<CaravanContent> = {}): CaravanContent {
  return ensureCaravan({
    id: 'caravan-forest-ruins' as CaravanId,
    name: 'Forest Ruins',
    ...overrides,
  });
}

function buildTown(overrides: TownContentInput = {}): TownContent {
  return ensureTown({
    id: 'town-forest-ruins' as TownId,
    name: 'Forest Ruins',
    level: 5,
    ...overrides,
  });
}

describe('encounter-backed node accessors', () => {
  describe('isWorldNodeHidden', () => {
    it('is true when the matching encounter is marked hidden', () => {
      seedContent([buildEncounter({ hidden: true })]);

      expect(isWorldNodeHidden(buildEntry())).toBe(true);
    });

    it('is false when the matching encounter is not hidden', () => {
      seedContent([buildEncounter({ hidden: false })]);

      expect(isWorldNodeHidden(buildEntry())).toBe(false);
    });

    it('is false when there is no matching content', () => {
      expect(isWorldNodeHidden(buildEntry())).toBe(false);
    });

    it('is true when the matching town is marked hidden', () => {
      seedContent([buildTown({ hidden: true })]);

      expect(isWorldNodeHidden(buildEntry())).toBe(true);
    });
  });

  describe('isWorldNodeVisible', () => {
    it('is true for a non-hidden node', () => {
      seedContent([buildEncounter({ hidden: false })]);

      expect(isWorldNodeVisible(buildEntry())).toBe(true);
    });

    it('is false for a hidden node that has not been discovered', () => {
      seedContent([buildEncounter({ hidden: true })]);

      expect(isWorldNodeVisible(buildEntry())).toBe(false);
    });

    it('is true for a hidden node that has been discovered', () => {
      seedContent([buildEncounter({ hidden: true })]);
      found({ node: true });

      expect(isWorldNodeVisible(buildEntry())).toBe(true);
    });

    it('is false for a collectible-gated node whose gate is unmet, even though it is not hidden', () => {
      seedContent([
        buildEncounter({
          hidden: false,
          invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
        }),
      ]);

      expect(isWorldNodeVisible(buildEntry())).toBe(false);
    });

    it('is true for a collectible-gated node once every required collectible is found', () => {
      seedContent([
        buildEncounter({
          hidden: false,
          invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
        }),
      ]);
      found({ collectibles: ['Gobweb', 'ruby'] });

      expect(isWorldNodeVisible(buildEntry())).toBe(true);
    });
  });

  describe('isWorldNodeCollectibleGateMet', () => {
    it('is vacuously true for a node with no gate', () => {
      seedContent([buildEncounter()]);

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(true);
    });

    it('is false when any required collectible has not been found', () => {
      seedContent([
        buildEncounter({
          invisibleUntilCollectibleIdsFound: [
            'Gobweb' as CollectibleId,
            'Venom Orb' as CollectibleId,
          ],
        }),
      ]);
      found({ collectibles: ['Gobweb'] });

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(false);
    });

    it('is true once every required collectible has been found', () => {
      seedContent([
        buildEncounter({
          invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
        }),
      ]);
      found({ collectibles: ['Gobweb', 'ruby'] });

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(true);
    });

    it('reads the gate off a caravan-backed node too', () => {
      seedContent([
        buildCaravan({
          invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
        }),
      ]);

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(false);

      found({ collectibles: ['Gobweb', 'ruby'] });

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(true);
    });

    it('reads the gate off a town-backed node too', () => {
      seedContent([
        buildTown({
          invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
        }),
      ]);

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(false);

      found({ collectibles: ['Gobweb', 'ruby'] });

      expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(true);
    });
  });

  describe('worldNodeOverride', () => {
    it('reads the matching node override', () => {
      seedContent([
        buildNodeOverride({ description: 'A hand-written blurb.' }),
      ]);

      expect(worldNodeOverride(buildEntry())?.description).toBe(
        'A hand-written blurb.',
      );
    });

    it('returns undefined when there is no matching override', () => {
      expect(worldNodeOverride(buildEntry())).toBeUndefined();
    });
  });

  describe('worldNodeTown', () => {
    it('reads the matching town', () => {
      seedContent([buildTown({ level: 25 })]);

      expect(worldNodeTown(buildEntry())?.level).toBe(25);
    });

    it('returns undefined when there is no matching town', () => {
      expect(worldNodeTown(buildEntry())).toBeUndefined();
    });

    it('returns undefined for a same-name node backed by a different content type', () => {
      seedContent([buildEncounter()]);

      expect(worldNodeTown(buildEntry())).toBeUndefined();
    });
  });
});

describe('trainer-backed node accessors', () => {
  const trainer = (overrides: Partial<TrainerContent> = {}) =>
    ensureTrainer({
      id: 'trainer-forest-ruins' as TrainerId,
      name: 'Forest Ruins',
      ...overrides,
    });

  it('reads the matching trainer', () => {
    seedContent([trainer()]);

    expect(worldNodeTrainer(buildEntry())?.id).toBe('trainer-forest-ruins');
  });

  it('hides a trainer marked hidden until discovered', () => {
    seedContent([trainer({ hidden: true })]);

    expect(isWorldNodeHidden(buildEntry())).toBe(true);
    expect(isWorldNodeVisible(buildEntry())).toBe(false);
  });

  it('gates a trainer behind its collectibles', () => {
    seedContent([
      trainer({
        invisibleUntilCollectibleIdsFound: ['ruby' as CollectibleId],
      }),
    ]);

    expect(isWorldNodeCollectibleGateMet(buildEntry())).toBe(false);
  });
});

describe('worldNodeDisplayName', () => {
  it('returns the real name for a visible node', () => {
    seedContent([buildEncounter({ hidden: false })]);
    seedWorldNodes([{ name: 'Forest Ruins', type: 'ExploreNode' }]);

    expect(worldNodeDisplayName('Forest Ruins')).toBe('Forest Ruins');
  });

  it('masks a hidden, undiscovered node as "???"', () => {
    seedContent([buildEncounter({ hidden: true })]);
    seedWorldNodes([{ name: 'Forest Ruins', type: 'ExploreNode' }]);

    expect(worldNodeDisplayName('Forest Ruins')).toBe('???');
  });

  it('returns the real name for a hidden node once discovered', () => {
    seedContent([buildEncounter({ hidden: true })]);
    seedWorldNodes([{ name: 'Forest Ruins', type: 'ExploreNode' }]);
    found({ node: true });

    expect(worldNodeDisplayName('Forest Ruins')).toBe('Forest Ruins');
  });

  it('falls back to the raw name when the node no longer resolves', () => {
    expect(worldNodeDisplayName('Ghost Node')).toBe('Ghost Node');
  });
});

describe('isWorldNodeMapVisited', () => {
  it("follows whether the node's map has been visited", () => {
    seedWorldNodes([{ name: 'Forest Ruins', type: 'ExploreNode' }]);
    seedGamestate();
    expect(isWorldNodeMapVisited('Forest Ruins')).toBe(false);

    seedGamestate((state) => {
      state.discoveredMaps['TestMap'] = { foundAt: 1 };
    });
    expect(isWorldNodeMapVisited('Forest Ruins')).toBe(true);
  });

  it('treats an unplaced name as visited', () => {
    expect(isWorldNodeMapVisited('Ghost Node')).toBe(true);
  });
});
