import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/hero/travel-cost-base');
vi.mock('@helpers/pathfinding/pathfinding-travel');

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { worldTownsState } from '@helpers/state-game';
import {
  townWorkerAssignmentIsValid,
  townWorkerStaminaCostToNode,
} from '@helpers/town/worker/town-worker-travel';
import { townWorkerTripHost } from '@helpers/town/worker/town-worker-trip';
import {
  workerTripBeginOutbound,
  workerTripBeginReturn,
} from '@helpers/worker/worker-trip';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import type {
  EncounterId,
  GatheringId,
  ItemId,
  MonsterId,
  TownId,
  TownWorkerState,
  TravelStep,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const ore = 'copper-ore' as ItemId;
const town = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });
const mine = ensureGathering({
  id: 'mine' as GatheringId,
  name: 'Copper Mine',
  gatherResults: [
    ensureGatherResult({ chance: 1, items: [{ itemId: ore, quantity: 1 }] }),
  ],
});
const worker = ensureWorker({
  id: 'darwin' as WorkerId,
  name: 'Darwin',
  baseStats: {
    capacity: 5,
    gatherSpeed: 1,
    craftSpeed: 0,
    stamina: 20,
    combatPower: 0,
    combatSpeed: 0,
  },
  statsPerLevel: {
    capacity: 0,
    gatherSpeed: 0,
    craftSpeed: 0,
    stamina: 5,
    combatPower: 0,
    combatSpeed: 0,
  },
});
const grounded = ensureWorker({
  ...worker,
  id: 'grounded' as WorkerId,
  canUseTeleports: false,
});
const assignment = { nodeName: mine.name, itemId: ore };
const path: TravelStep[] = [{ kind: 'Move', mapName: 'TestMap', x: 1, y: 1 }];

function seedTown(workerState: Partial<TownWorkerState> = {}) {
  const nodes = seedWorldNodes([
    { name: town.name, type: 'NonPlayerKingdom' },
    { name: mine.name, type: 'GatherNode' },
  ]);
  seedGamestate((state) => {
    state.world.towns[town.id] = buildTownNodeState({
      workers: {
        [worker.id]: { ...defaultTownWorkerState(town, 1), ...workerState },
        [grounded.id]: defaultTownWorkerState(town, 1),
      },
    });
  });
  return nodes;
}

const workerState = (id: WorkerId = worker.id) =>
  worldTownsState()[town.id].workers[id];

// Town workers never take collectible-gated shortcuts, walk through nodes, or use the player's outposts.
const noOutpostRoute = (allowTeleport: boolean) => [
  allowTeleport,
  false,
  false,
  'None',
];

// The real route lookup has its own spec; here every route from the town costs `cost` ticks.
function routesCost(cost: number | undefined): void {
  vi.mocked(travelPathFrom).mockReturnValue(
    cost === undefined ? undefined : path,
  );
  vi.mocked(travelPathBaseTotalTicks).mockReturnValue(cost ?? 0);
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([town, mine, worker, grounded]);
});

describe('townWorkerStaminaCostToNode', () => {
  it('costs the route from the town’s own node', () => {
    const nodes = seedTown();
    routesCost(12);

    expect(townWorkerStaminaCostToNode(town, mine.name)).toBe(12);
    expect(vi.mocked(travelPathFrom).mock.calls[0]).toEqual([
      nodes[town.name],
      mine.name,
      ...noOutpostRoute(true),
    ]);
  });

  it('is undefined without a route, or without a town node', () => {
    seedTown();
    routesCost(undefined);
    expect(townWorkerStaminaCostToNode(town, mine.name)).toBeUndefined();

    routesCost(12);
    seedWorldNodes([{ name: mine.name, type: 'GatherNode' }]);
    expect(townWorkerStaminaCostToNode(town, mine.name)).toBeUndefined();
  });
});

describe('townWorkerAssignmentIsValid', () => {
  it('needs the node to yield the item within the worker’s stamina at its level', () => {
    seedTown();

    routesCost(20);
    expect(townWorkerAssignmentIsValid(town, worker.id, 1, assignment)).toBe(
      true,
    );

    routesCost(21);
    expect(townWorkerAssignmentIsValid(town, worker.id, 1, assignment)).toBe(
      false,
    );
    expect(townWorkerAssignmentIsValid(town, worker.id, 2, assignment)).toBe(
      true,
    );

    routesCost(undefined);
    expect(townWorkerAssignmentIsValid(town, worker.id, 9, assignment)).toBe(
      false,
    );
  });

  it('rejects an item the node doesn’t yield, or a worker gone from content', () => {
    seedTown();
    routesCost(1);

    expect(
      townWorkerAssignmentIsValid(town, worker.id, 1, {
        ...assignment,
        itemId: 'iron-ore' as ItemId,
      }),
    ).toBe(false);
    expect(
      townWorkerAssignmentIsValid(town, 'gone' as WorkerId, 1, assignment),
    ).toBe(false);
  });

  it('routes without teleports for a worker that can’t use them', () => {
    seedTown();
    routesCost(1);

    townWorkerAssignmentIsValid(town, grounded.id, 1, assignment);

    expect(vi.mocked(travelPathFrom).mock.calls[0].slice(2)).toEqual(
      noOutpostRoute(false),
    );
  });
});

describe('townWorkerAssignmentIsValid (combat node)', () => {
  const den = 'Goblin Den';
  const fighter = (combatPower: number) =>
    ensureWorker({
      ...worker,
      baseStats: { ...worker.baseStats, combatPower, combatSpeed: 1 },
    });
  const seedDen = (combatPower: number) => {
    seedContent([
      town,
      fighter(combatPower),
      ...[
        'Gold Coin',
        'Crimson Lucre',
        'Trader Scrip',
        'Duskhall Flux',
        'Memory Flux',
      ].map((name) => ensureItem({ id: name as ItemId, name })),
      ensureMonster({
        id: 'goblin' as MonsterId,
        name: 'Goblin',
        drops: [ensureDroppedReward({ itemId: ore, chance: 50 })],
      }),
      ensureEncounter({
        id: 'den' as EncounterId,
        name: den,
        levelRange: { min: 15, max: 20 },
        fights: [{ monsters: [{ monsterId: 'goblin' as MonsterId }] }],
      }),
    ]);
    seedWorldNodes([
      { name: town.name, type: 'NonPlayerKingdom' },
      { name: den, type: 'ExploreNode' },
    ]);
    seedGamestate();
  };
  const valid = () =>
    townWorkerAssignmentIsValid(town, worker.id, 1, {
      nodeName: den,
      itemId: ore,
    });

  it('needs no player progress, only power at the node level and stamina', () => {
    routesCost(20);
    seedDen(20);
    expect(valid()).toBe(true);

    seedDen(19);
    expect(valid()).toBe(false);

    seedDen(20);
    routesCost(21);
    expect(valid()).toBe(false);
  });
});

describe('town worker outbound trip', () => {
  it('sends the worker toward its assignment along the route', () => {
    const nodes = seedTown();
    routesCost(5);

    inTick(() =>
      workerTripBeginOutbound(townWorkerTripHost(town, worker.id), assignment),
    );

    expect(vi.mocked(travelPathFrom).mock.calls[0]).toEqual([
      nodes[town.name],
      mine.name,
      ...noOutpostRoute(true),
    ]);
    expect(workerState()).toMatchObject({
      assignment,
      status: {
        kind: 'TravelingTo',
        nodeName: mine.name,
        itemId: ore,
        path,
        ticksIntoStep: 0,
      },
    });
  });

  it('leaves the worker at town with no route or no town node', () => {
    seedTown();
    routesCost(undefined);
    inTick(() =>
      workerTripBeginOutbound(townWorkerTripHost(town, worker.id), assignment),
    );
    expect(workerState()).toMatchObject({
      assignment: null,
      status: { kind: 'AtTown' },
    });

    routesCost(5);
    seedWorldNodes([{ name: mine.name, type: 'GatherNode' }]);
    inTick(() =>
      workerTripBeginOutbound(townWorkerTripHost(town, worker.id), assignment),
    );
    expect(workerState().status.kind).toBe('AtTown');
  });

  it('routes without teleports for a worker that can’t use them', () => {
    seedTown();
    routesCost(5);

    inTick(() =>
      workerTripBeginOutbound(
        townWorkerTripHost(town, grounded.id),
        assignment,
      ),
    );

    expect(vi.mocked(travelPathFrom).mock.calls[0].slice(2)).toEqual(
      noOutpostRoute(false),
    );
  });
});

describe('town worker return trip', () => {
  it('heads home from where the worker stands, carrying its haul', () => {
    const nodes = seedTown();
    const atMine = locationOf(nodes[mine.name]);
    seedGamestate((state) => {
      state.world.towns[town.id] = buildTownNodeState({
        workers: {
          [worker.id]: { ...defaultTownWorkerState(town, 1), location: atMine },
        },
      });
    });
    routesCost(5);

    inTick(() =>
      workerTripBeginReturn(townWorkerTripHost(town, worker.id), {
        itemId: ore,
        quantity: 5,
      }),
    );

    expect(workerState().status).toEqual({
      kind: 'TravelingBack',
      path,
      ticksIntoStep: 0,
      carriedItemId: ore,
      carriedQuantity: 5,
    });
    expect(vi.mocked(travelPathFrom).mock.calls[0]).toEqual([
      atMine,
      town.name,
      ...noOutpostRoute(true),
    ]);
  });

  it('parks the worker at town, dropping its haul, when no route home resolves', () => {
    seedTown({
      status: {
        kind: 'Gathering',
        ...assignment,
        itemsGathered: 3,
        ticksIntoGather: 0,
      },
    });
    routesCost(undefined);

    inTick(() =>
      workerTripBeginReturn(townWorkerTripHost(town, worker.id), {
        itemId: ore,
        quantity: 5,
      }),
    );

    expect(workerState().status).toEqual({ kind: 'AtTown' });
  });
});
