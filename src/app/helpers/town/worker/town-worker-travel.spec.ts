import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelPathTotalTicks: vi.fn(),
}));

vi.mock('@helpers/pathfinding/pathfinding-travel', () => ({
  travelPathFrom: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-progression', () => ({
  townWorkerStatsForLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  gatheringResultsAtLevel: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-level', () => ({
  worldNodeLevel: vi.fn(() => 1),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeByName: vi.fn(),
  worldNodeGathering: vi.fn(),
}));

import { getEntry } from '@helpers/content/content';
import { travelPathTotalTicks } from '@helpers/hero/travel';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { townWorkerStatsForLevel } from '@helpers/town/worker/town-worker-progression';
import {
  townWorkerAssignmentIsValid,
  townWorkerBeginOutboundTrip,
  townWorkerBeginReturnTrip,
  townWorkersTravelingTokens,
  townWorkerStaminaCostToNode,
} from '@helpers/town/worker/town-worker-travel';
import { gatheringResultsAtLevel } from '@helpers/world-node/world-node-gathering';
import {
  worldNodeByName,
  worldNodeGathering,
} from '@helpers/world-node/world-nodes';
import type {
  GameState,
  ItemId,
  TownContent,
  TownId,
  WorkerId,
  WorldNodeEntry,
} from '@interfaces';

const townId = 'larsia' as TownId;
const workerId = 'darwin' as WorkerId;
const oreId = 'copper-ore' as ItemId;

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

function buildTown(): TownContent {
  return { id: townId, name: 'Larsia' } as TownContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('townWorkerStaminaCostToNode', () => {
  it('returns undefined when the town has no world node', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(townWorkerStaminaCostToNode(buildTown(), 'Wergen Woods')).toBe(
      undefined,
    );
  });

  it('returns undefined when no path resolves', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    } as WorldNodeEntry);
    vi.mocked(travelPathFrom).mockReturnValue(undefined);

    expect(townWorkerStaminaCostToNode(buildTown(), 'Wergen Woods')).toBe(
      undefined,
    );
  });

  it('returns the total tick cost of the resolved path', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    } as WorldNodeEntry);
    vi.mocked(travelPathFrom).mockReturnValue([
      { kind: 'Move', mapName: 'Carrina', x: 6, y: 5 },
    ] as never);
    vi.mocked(travelPathTotalTicks).mockReturnValue(12);

    expect(townWorkerStaminaCostToNode(buildTown(), 'Wergen Woods')).toBe(12);
  });
});

describe('townWorkerAssignmentIsValid', () => {
  const assignment = { nodeName: 'Wergen Woods', itemId: oreId };

  beforeEach(() => {
    vi.mocked(getEntry).mockReturnValue({} as never);
    vi.mocked(townWorkerStatsForLevel).mockReturnValue({
      capacity: 5,
      gatherSpeed: 1,
      stamina: 20,
    });
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    } as WorldNodeEntry);
    vi.mocked(worldNodeGathering).mockReturnValue({} as never);
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 10, items: [{ itemId: oreId, quantity: 1 }] },
    ] as never);
    vi.mocked(travelPathFrom).mockReturnValue([
      { kind: 'Move', mapName: 'Carrina', x: 6, y: 5 },
    ] as never);
    vi.mocked(travelPathTotalTicks).mockReturnValue(10);
  });

  it('is valid when the node has the item and stamina covers the trip', () => {
    expect(
      townWorkerAssignmentIsValid(buildTown(), workerId, 1, assignment),
    ).toBe(true);
  });

  it('is invalid when the worker content cannot be found', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    expect(
      townWorkerAssignmentIsValid(buildTown(), workerId, 1, assignment),
    ).toBe(false);
  });

  it('is invalid when the node does not gather the assigned item', () => {
    vi.mocked(gatheringResultsAtLevel).mockReturnValue([
      { chance: 10, items: [{ itemId: 'iron-ore' as ItemId, quantity: 1 }] },
    ] as never);

    expect(
      townWorkerAssignmentIsValid(buildTown(), workerId, 1, assignment),
    ).toBe(false);
  });

  it('is invalid when the trip cost exceeds stamina', () => {
    vi.mocked(travelPathTotalTicks).mockReturnValue(999);

    expect(
      townWorkerAssignmentIsValid(buildTown(), workerId, 1, assignment),
    ).toBe(false);
  });
});

describe('townWorkerBeginOutboundTrip', () => {
  it('no-ops when the town has no world node', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    townWorkerBeginOutboundTrip(townId, buildTown(), workerId, {
      nodeName: 'Wergen Woods',
      itemId: oreId,
    });

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('no-ops when no path resolves', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    } as WorldNodeEntry);
    vi.mocked(travelPathFrom).mockReturnValue(undefined);

    townWorkerBeginOutboundTrip(townId, buildTown(), workerId, {
      nodeName: 'Wergen Woods',
      itemId: oreId,
    });

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('sets the TravelingTo status with the resolved path', () => {
    vi.mocked(worldNodeByName).mockReturnValue({
      mapName: 'Carrina',
      x: 5,
      y: 5,
    } as WorldNodeEntry);
    const path = [{ kind: 'Move', mapName: 'Carrina', x: 6, y: 5 }];
    vi.mocked(travelPathFrom).mockReturnValue(path as never);

    townWorkerBeginOutboundTrip(townId, buildTown(), workerId, {
      nodeName: 'Wergen Woods',
      itemId: oreId,
    });

    const state = applyLastUpdate({
      world: { towns: { [townId]: { workers: { [workerId]: {} } } } },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toMatchObject({
      kind: 'TravelingTo',
      nodeName: 'Wergen Woods',
      itemId: oreId,
      path,
      ticksIntoStep: 0,
    });
    expect(state.world.towns[townId].workers[workerId].assignment).toEqual({
      nodeName: 'Wergen Woods',
      itemId: oreId,
    });
  });
});

describe('townWorkerBeginReturnTrip', () => {
  it('starts the TravelingBack status when a path home resolves', () => {
    const path = [{ kind: 'Move', mapName: 'Carrina', x: 4, y: 5 }];
    vi.mocked(travelPathFrom).mockReturnValue(path as never);

    townWorkerBeginReturnTrip(townId, buildTown(), workerId, oreId, 5);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: { location: { mapName: 'Carrina', x: 6, y: 5 } },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toMatchObject({
      kind: 'TravelingBack',
      path,
      carriedItemId: oreId,
      carriedQuantity: 5,
    });
  });

  it('parks AtTown with cargo discarded when no path home resolves', () => {
    vi.mocked(travelPathFrom).mockReturnValue(undefined);

    townWorkerBeginReturnTrip(townId, buildTown(), workerId, oreId, 5);

    const state = applyLastUpdate({
      world: {
        towns: {
          [townId]: {
            workers: {
              [workerId]: { location: { mapName: 'Carrina', x: 6, y: 5 } },
            },
          },
        },
      },
    } as unknown as GameState);
    expect(state.world.towns[townId].workers[workerId].status).toEqual({
      kind: 'AtTown',
    });
  });
});

describe('townWorkersTravelingTokens', () => {
  // Single read: it's a computed(), so a second call in this file would replay this mock's
  // cached result rather than re-invoking the mocked gamestate().
  it('returns only TravelingTo/TravelingBack workers across every town, tagged with townId', () => {
    const otherTownId = 'carrina' as TownId;
    const travelingToId = 'darwin' as WorkerId;
    const travelingBackId = 'talbot' as WorkerId;
    const atTownId = 'nevyn' as WorkerId;
    const gatheringId = 'weaver' as WorkerId;

    vi.mocked(gamestate).mockReturnValue({
      world: {
        towns: {
          [townId]: {
            workers: {
              [travelingToId]: {
                location: { mapName: 'LarsianDesert', x: 0, y: 0 },
                status: {
                  kind: 'TravelingTo',
                  nodeName: 'Wergen Woods',
                  itemId: oreId,
                  path: [{ kind: 'Move', mapName: 'LarsianDesert', x: 1, y: 0 }],
                  ticksIntoStep: 2,
                },
              },
              [atTownId]: {
                location: { mapName: 'LarsianDesert', x: 0, y: 0 },
                status: { kind: 'AtTown' },
              },
              [gatheringId]: {
                location: { mapName: 'LarsianDesert', x: 5, y: 5 },
                status: {
                  kind: 'Gathering',
                  nodeName: 'Wergen Woods',
                  itemId: oreId,
                  itemsGathered: 1,
                  ticksIntoGather: 1,
                },
              },
            },
          },
          [otherTownId]: {
            workers: {
              [travelingBackId]: {
                location: { mapName: 'Carrina', x: 3, y: 3 },
                status: {
                  kind: 'TravelingBack',
                  path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }],
                  ticksIntoStep: 1,
                  carriedItemId: oreId,
                  carriedQuantity: 5,
                },
              },
            },
          },
        },
      },
    } as unknown as GameState);

    expect(townWorkersTravelingTokens()).toEqual([
      {
        townId,
        workerId: travelingToId,
        mapName: 'LarsianDesert',
        path: [{ kind: 'Move', mapName: 'LarsianDesert', x: 1, y: 0 }],
        ticksIntoStep: 2,
      },
      {
        townId: otherTownId,
        workerId: travelingBackId,
        mapName: 'Carrina',
        path: [{ kind: 'Move', mapName: 'Carrina', x: 2, y: 3 }],
        ticksIntoStep: 1,
      },
    ]);
  });
});
