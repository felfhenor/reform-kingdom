import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel-cost');

import { OUTPOST_TELEPORT_LEVEL } from '@helpers/config';
import { ensureNodeOverride } from '@helpers/content/ensure-nodeoverride';
import {
  travelPathTotalTicks,
  travelStepTicksCost,
} from '@helpers/hero/travel-cost';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import {
  travelPathFrom,
  travelPathThroughNodesTo,
  travelPathTo,
} from '@helpers/pathfinding/pathfinding-travel';
import type {
  CollectibleId,
  CurrentLocation,
  NodeOverrideId,
  WorldNodeType,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

// Route selection must never use buff-aware costs, so any call fails the test.
beforeEach(() => {
  vi.resetAllMocks();
  const boostedCostUsed = () => {
    throw new Error('route selection used a buff-aware travel cost');
  };
  vi.mocked(travelStepTicksCost).mockImplementation(boostedCostUsed);
  vi.mocked(travelPathTotalTicks).mockImplementation(boostedCostUsed);
});

const standAt = (location: CurrentLocation) =>
  seedGamestate((state) => (state.world.currentLocation = location));

const carrina = (x: number, y: number) => ({ mapName: 'Carrina', x, y });

const node = (
  name: string,
  mapName: string,
  x: number,
  y: number,
  type: WorldNodeType = 'ExploreNode',
) => ({ name, type, mapName, x, y });

const teleportOut = (
  name: string,
  mapName: string,
  x: number,
  toTag: string,
) => ({
  ...node(name, mapName, x, 0, 'TeleportNode'),
  properties: [{ name: 'toTag', type: 'string', value: toTag }],
});

const teleportIn = (name: string, mapName: string, x: number, tag: string) => ({
  ...node(name, mapName, x, 0, 'TeleportNode'),
  properties: [{ name: 'tag', type: 'string', value: tag }],
});

const fiveByFive = { width: 5, height: 5 };

function lockBehindCollectible(...names: string[]): void {
  seedContent(
    names.map((name) =>
      ensureNodeOverride({
        id: name as NodeOverrideId,
        name,
        invisibleUntilCollectibleIdsFound: ['key' as CollectibleId],
      }),
    ),
  );
}

describe('travelPathTo', () => {
  it('returns an empty path when already at the destination', () => {
    seedWorldNodes([node('Field Ruins', 'Carrina', 2, 2)], [], {
      Carrina: fiveByFive,
    });
    standAt(carrina(2, 2));

    expect(travelPathTo('Field Ruins')).toEqual([]);
  });

  it('returns an in-map Move path on an open grid', () => {
    seedWorldNodes([node('Field Ruins', 'Carrina', 2, 0)], [], {
      Carrina: fiveByFive,
    });
    standAt(carrina(0, 0));

    expect(travelPathTo('Field Ruins')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ]);
  });

  it('returns undefined when no path exists on the current map', () => {
    seedWorldNodes([node('Field Ruins', 'Carrina', 2, 1)], [], {
      Carrina: {
        width: 3,
        height: 3,
        denseTiles: [carrina(1, 0), carrina(1, 1), carrina(1, 2)],
      },
    });
    standAt(carrina(0, 1));

    expect(travelPathTo('Field Ruins')).toBeUndefined();
  });

  describe('a node walled in behind another node', () => {
    function seedGatedMap(walls: { x: number; y: number }[]): void {
      seedWorldNodes(
        [node('Gate', 'Carrina', 1, 1), node('Behind', 'Carrina', 2, 1)],
        [],
        { Carrina: { width: 3, height: 3, denseTiles: walls } },
      );
      standAt(carrina(0, 1));
    }

    it('has no normal route past the gate node', () => {
      seedGatedMap([carrina(1, 0), carrina(1, 2)]);

      expect(travelPathTo('Behind')).toBeUndefined();
    });

    it('crosses the gate node when passing through nodes is allowed', () => {
      seedGatedMap([carrina(1, 0), carrina(1, 2)]);
      travelPathTo('Behind');

      expect(travelPathThroughNodesTo('Behind')).toEqual([
        { kind: 'Move', mapName: 'Carrina', x: 1, y: 1 },
        { kind: 'Move', mapName: 'Carrina', x: 2, y: 1 },
      ]);
    });

    it('still walks around a node when a route around it exists', () => {
      seedGatedMap([carrina(1, 2)]);

      expect(travelPathThroughNodesTo('Behind')).not.toContainEqual({
        kind: 'Move',
        mapName: 'Carrina',
        x: 1,
        y: 1,
      });
    });
  });

  it('returns undefined when the destination node does not exist', () => {
    seedWorldNodes([node('Field Ruins', 'Carrina', 2, 0)]);
    standAt(carrina(0, 0));

    expect(travelPathTo('Nowhere')).toBeUndefined();
  });

  describe('through a TeleportNode pair', () => {
    beforeEach(() => {
      seedWorldNodes(
        [
          teleportOut('To Craggled Mire', 'Carrina', 2, 'from-carrina'),
          teleportIn('To Carrina', 'CraggledMire', 0, 'from-carrina'),
          node('Forest Ruins', 'CraggledMire', 2, 0),
        ],
        [],
        { Carrina: fiveByFive, CraggledMire: fiveByFive },
      );
      standAt(carrina(0, 0));
    });

    const crossing = [
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
    ];
    const onToRuins = [
      ...crossing,
      { kind: 'Move', mapName: 'CraggledMire', x: 1, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 2, y: 0 },
    ];

    it('composes a cross-map path', () => {
      expect(travelPathTo('Forest Ruins')).toEqual(onToRuins);
    });

    it('refuses to cross maps at all when allowTeleport is false, even through an unlocked pair', () => {
      expect(travelPathTo('Forest Ruins', false)).toBeUndefined();
    });

    it('does not route through a pair still locked behind a collectible gate', () => {
      lockBehindCollectible('To Craggled Mire', 'To Carrina');

      expect(travelPathTo('Forest Ruins')).toBeUndefined();
    });

    it('routes through a locked pair when ignoreCollectibleGate is set', () => {
      lockBehindCollectible('To Craggled Mire', 'To Carrina');

      expect(travelPathTo('Forest Ruins', true, true)).toEqual(onToRuins);
    });

    it('travels through a TeleportNode when it is the destination itself, not just a waypoint', () => {
      expect(travelPathTo('To Craggled Mire')).toEqual(crossing);
    });

    it('has no route to a TeleportNode on another map', () => {
      standAt({ mapName: 'CraggledMire', x: 4, y: 4 });

      expect(travelPathTo('To Craggled Mire')).toBeUndefined();
    });

    it('refuses to travel directly to a TeleportNode at all when allowTeleport is false', () => {
      expect(travelPathTo('To Craggled Mire', false)).toBeUndefined();
    });

    it('refuses to travel directly to a TeleportNode still locked behind a collectible gate', () => {
      lockBehindCollectible('To Craggled Mire');

      expect(travelPathTo('To Craggled Mire')).toBeUndefined();
    });
  });

  it('routes around a node tile that is not the destination', () => {
    seedWorldNodes(
      [
        node('Some Other Node', 'Carrina', 1, 1),
        node('Field Ruins', 'Carrina', 2, 1),
      ],
      [],
      { Carrina: { width: 3, height: 3 } },
    );
    standAt(carrina(0, 1));

    const path = travelPathTo('Field Ruins');

    expect(path).not.toBeUndefined();
    expect(path?.some((step) => step.x === 1 && step.y === 1)).toBe(false);
  });

  it('detours onto a longer Path Tiles route instead of the shortest off-road one', () => {
    // Row 0 and column 4 are path; the shorter off-road diagonal costs more than the longer on-path route.
    const pathTiles = [0, 1, 2, 3, 4]
      .map((x) => carrina(x, 0))
      .concat([1, 2, 3, 4].map((y) => carrina(4, y)));
    seedWorldNodes([node('Field Ruins', 'Carrina', 4, 4)], pathTiles, {
      Carrina: fiveByFive,
    });
    standAt(carrina(0, 0));

    const path = travelPathTo('Field Ruins');

    expect(path).not.toBeUndefined();
    expect(path?.every((step) => step.x === 4 || step.y === 0)).toBe(true);
  });

  it('chains through two teleport hops when no single hop reaches the destination', () => {
    // Larsia only pairs with CraggledMire, not with the Kingdom's own map, so this needs two hops.
    seedWorldNodes(
      [
        teleportOut('To Mire', 'Carrina', 2, 'mire-from-carrina'),
        teleportIn('From Carrina', 'CraggledMire', 0, 'mire-from-carrina'),
        teleportOut('To Larsia', 'CraggledMire', 3, 'larsia-from-mire'),
        teleportIn('From Mire', 'Larsia', 0, 'larsia-from-mire'),
        node('Mescalin Expanse', 'Larsia', 2, 0),
      ],
      [],
      { Carrina: fiveByFive, CraggledMire: fiveByFive, Larsia: fiveByFive },
    );
    standAt(carrina(0, 0));

    expect(travelPathTo('Mescalin Expanse')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 1, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 2, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 3, y: 0 },
      { kind: 'Teleport', mapName: 'Larsia', x: 0, y: 0 },
      { kind: 'Move', mapName: 'Larsia', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Larsia', x: 2, y: 0 },
    ]);
  });

  it('picks the cheaper of two competing teleport routes, not just the first one found', () => {
    // Seeded before the cheaper exit, so a "first match wins" router would pick it.
    seedWorldNodes(
      [
        teleportOut('Far Exit', 'Carrina', 4, 'to-cm'),
        teleportOut('Near Exit', 'Carrina', 1, 'to-cm'),
        teleportIn('CM Entrance', 'CraggledMire', 0, 'to-cm'),
        node('Some Place', 'CraggledMire', 0, 2),
      ],
      [],
      { Carrina: fiveByFive, CraggledMire: fiveByFive },
    );
    standAt(carrina(0, 0));

    expect(travelPathTo('Some Place')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 0, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 0, y: 1 },
      { kind: 'Move', mapName: 'CraggledMire', x: 0, y: 2 },
    ]);
  });

  it('returns undefined when no teleport chain connects to the destination map at all', () => {
    seedWorldNodes(
      [
        teleportOut('To Mire', 'Carrina', 2, 'mire-from-carrina'),
        teleportIn('From Carrina', 'CraggledMire', 0, 'mire-from-carrina'),
        node('Mescalin Expanse', 'Larsia', 2, 0),
      ],
      [],
      { Carrina: fiveByFive, CraggledMire: fiveByFive, Larsia: fiveByFive },
    );
    standAt(carrina(0, 0));

    expect(travelPathTo('Mescalin Expanse')).toBeUndefined();
  });
});

describe('travelPathFrom', () => {
  beforeEach(() => {
    seedWorldNodes([node('Field Ruins', 'Carrina', 2, 0)], [], {
      Carrina: fiveByFive,
    });
  });

  // Worker travel relies on paths from a non-party origin.
  it('paths from an arbitrary origin, not just the current location', () => {
    standAt(carrina(4, 4));

    expect(travelPathFrom(carrina(0, 0), 'Field Ruins')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 2, y: 0 },
    ]);
  });

  it('returns undefined when the destination node does not exist', () => {
    expect(travelPathFrom(carrina(0, 0), 'Nowhere')).toBeUndefined();
  });

  it('caches by (origin, destination)', () => {
    const first = travelPathFrom(carrina(0, 0), 'Field Ruins');

    expect(travelPathFrom(carrina(0, 0), 'Field Ruins')).toBe(first);
  });

  it('invalidates the cache once the maps reload', () => {
    const first = travelPathFrom(carrina(0, 0), 'Field Ruins');

    seedWorldNodes([node('Field Ruins', 'Carrina', 2, 0)], [], {
      Carrina: fiveByFive,
    });
    const second = travelPathFrom(carrina(0, 0), 'Field Ruins');

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });

  // A newly-found collectible can unlock a gated TeleportNode, so a cached route must not outlive it.
  it('invalidates the cache once a new collectible is discovered', () => {
    const first = travelPathFrom(carrina(0, 0), 'Field Ruins');

    seedGamestate((state) =>
      applyCollectibleGrant(state, 'relic' as CollectibleId, 1),
    );
    const second = travelPathFrom(carrina(0, 0), 'Field Ruins');

    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});

describe('travelPathFrom via teleport-level outposts', () => {
  const ready = OUTPOST_TELEPORT_LEVEL;
  const notReady = OUTPOST_TELEPORT_LEVEL - 1;

  const twentyByThree = { width: 20, height: 3 };
  const origin = carrina(0, 0);

  function seedOutposts(levels: Record<string, number>): void {
    seedGamestate((state) => {
      state.outposts = Object.fromEntries(
        Object.entries(levels).map(([name, level]) => [name, { level }]),
      );
    });
  }

  beforeEach(() => {
    seedWorldNodes(
      [
        node('Carrina Outpost', 'Carrina', 1, 0, 'Outpost'),
        node('Mire Outpost', 'CraggledMire', 1, 0, 'Outpost'),
        node('Bog', 'CraggledMire', 2, 0),
      ],
      [],
      { Carrina: twentyByThree, CraggledMire: twentyByThree },
    );
  });

  it('hops between maps through two teleport-level outposts with no TeleportNode pair', () => {
    seedOutposts({ 'Carrina Outpost': ready, 'Mire Outpost': ready });

    expect(travelPathFrom(origin, 'Bog')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 1, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 2, y: 0 },
    ]);
  });

  it('ignores an outpost below teleport level, and the cache picks it up once it levels', () => {
    seedOutposts({ 'Carrina Outpost': ready, 'Mire Outpost': notReady });

    expect(travelPathFrom(origin, 'Bog')).toBeUndefined();

    seedOutposts({ 'Carrina Outpost': ready, 'Mire Outpost': ready });
    expect(travelPathFrom(origin, 'Bog')).toHaveLength(3);
  });

  it('never hops when teleports are disallowed, for content-only tooling, or with outpost routing off', () => {
    seedOutposts({ 'Carrina Outpost': ready, 'Mire Outpost': ready });

    expect(travelPathFrom(origin, 'Bog', false)).toBeUndefined();
    expect(travelPathFrom(origin, 'Bog', true, true)).toBeUndefined();
    expect(
      travelPathFrom(origin, 'Bog', true, false, false, 'None'),
    ).toBeUndefined();
  });

  it('AllMaxed hops through every outpost regardless of save levels, even for content-only tooling', () => {
    seedOutposts({});

    expect(
      travelPathFrom(origin, 'Bog', true, true, false, 'AllMaxed'),
    ).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Teleport', mapName: 'CraggledMire', x: 1, y: 0 },
      { kind: 'Move', mapName: 'CraggledMire', x: 2, y: 0 },
    ]);
    expect(travelPathFrom(origin, 'Bog', true, true)).toBeUndefined();
  });

  it('AllMaxed skips collectible-gated outposts unless gates are ignored', () => {
    seedOutposts({});
    lockBehindCollectible('Mire Outpost');

    expect(
      travelPathFrom(origin, 'Bog', true, false, false, 'AllMaxed'),
    ).toBeUndefined();
    expect(
      travelPathFrom(origin, 'Bog', true, true, false, 'AllMaxed'),
    ).toHaveLength(3);
  });

  it('takes an outpost hop within one map when it beats walking', () => {
    seedWorldNodes(
      [
        node('Carrina Outpost', 'Carrina', 1, 0, 'Outpost'),
        node('Far Outpost', 'Carrina', 18, 0, 'Outpost'),
        node('Cliff', 'Carrina', 19, 0),
      ],
      [],
      { Carrina: twentyByThree },
    );
    seedOutposts({ 'Carrina Outpost': ready, 'Far Outpost': ready });

    expect(travelPathFrom(origin, 'Cliff')).toEqual([
      { kind: 'Move', mapName: 'Carrina', x: 1, y: 0 },
      { kind: 'Teleport', mapName: 'Carrina', x: 18, y: 0 },
      { kind: 'Move', mapName: 'Carrina', x: 19, y: 0 },
    ]);
  });
});
