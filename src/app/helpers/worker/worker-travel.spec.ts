import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/pathfinding/pathfinding-travel');

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { getMaterialQuantity } from '@helpers/item/materials';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { workersState } from '@helpers/state-game';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import { workerAssign, workerRecall } from '@helpers/worker/worker-travel';
import {
  workerTripBeginOutbound,
  workerTripBeginReturn,
} from '@helpers/worker/worker-trip';
import { kingdomWorkerTripHost } from '@helpers/worker/worker-trip-kingdom';
import type {
  GameState,
  GatheringId,
  ItemId,
  RecipeId,
  TravelStep,
  WorkerContent,
  WorkerId,
  WorkerState,
  WorldNodeEntry,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const workerId = 'weaver-nell' as WorkerId;
const copperId = 'copper-ore' as ItemId;
const woods = 'Wergen Woods';
const assignment = { nodeName: woods, itemId: copperId };
const path: TravelStep[] = [
  { kind: 'Move', mapName: 'TestMap', x: 1, y: 0 },
  { kind: 'Move', mapName: 'TestMap', x: 2, y: 0 },
];

let duchy: WorldNodeEntry;

function seedWorker(overrides: Partial<WorkerContent> = {}): void {
  seedContent([
    ensureWorker({ id: workerId, name: 'Weaver Nell', ...overrides }),
    ensureGathering({
      id: 'woods' as GatheringId,
      name: woods,
      gatherResults: [
        ensureGatherResult({
          chance: 10,
          items: [{ itemId: copperId, quantity: 1 }],
        }),
      ],
    }),
  ]);
}

function seedWorkerState(
  overrides: Partial<WorkerState> = {},
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.workers[workerId] = { ...defaultWorkerState(), ...overrides };
    state.discoveredGatherNodes[woods] = { foundAt: 1 };
    edit?.(state);
  });
}

function tripCost(): number {
  return travelPathBaseTotalTicks(path, duchy);
}

function staminaFor(cost: number): Partial<WorkerContent> {
  return {
    baseStats: { capacity: 5, gatherSpeed: 1, craftSpeed: 0, stamina: cost },
    statsPerLevel: { capacity: 0, gatherSpeed: 0, craftSpeed: 0, stamina: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  duchy = seedWorldNodes([
    { name: 'The Duchy', type: 'Kingdom' },
    { name: woods, type: 'GatherNode' },
  ])['The Duchy'];
  vi.mocked(travelPathFrom).mockReturnValue(path);
  seedWorker();
});

describe('kingdom worker outbound trip', () => {
  it('sets the worker traveling to the node along the routed path', () => {
    seedWorker({ canUseTeleports: false });
    seedWorkerState();

    inTick(() =>
      workerTripBeginOutbound(kingdomWorkerTripHost(workerId), assignment),
    );

    expect(travelPathFrom).toHaveBeenCalledWith(duchy, woods, false);
    expect(workersState()[workerId].status).toEqual({
      kind: 'TravelingTo',
      nodeName: woods,
      itemId: copperId,
      path,
      ticksIntoStep: 0,
    });
  });

  it('leaves the worker at the duchy when no route resolves', () => {
    vi.mocked(travelPathFrom).mockReturnValue(undefined);
    seedWorkerState();

    inTick(() =>
      workerTripBeginOutbound(kingdomWorkerTripHost(workerId), assignment),
    );

    expect(workersState()[workerId].status).toEqual({ kind: 'AtDuchy' });
  });
});

describe('kingdom worker return trip', () => {
  const location = { mapName: 'TestMap', x: 3, y: 3 };

  it('heads home from where the worker is, carrying its haul', () => {
    seedWorker({ canUseTeleports: false });
    seedWorkerState({ location });

    expect(
      inTick(() =>
        workerTripBeginReturn(kingdomWorkerTripHost(workerId), {
          itemId: copperId,
          quantity: 4,
        }),
      ),
    ).toBe(true);
    expect(travelPathFrom).toHaveBeenCalledWith(location, 'The Duchy', false);
    expect(workersState()[workerId].status).toEqual({
      kind: 'TravelingBack',
      path,
      ticksIntoStep: 0,
      carriedItemId: copperId,
      carriedQuantity: 4,
    });
  });

  it('parks the worker at the duchy, dropping the haul, when no route home resolves', () => {
    vi.mocked(travelPathFrom).mockReturnValue(undefined);
    seedWorkerState({
      location,
      status: {
        kind: 'TravelingTo',
        nodeName: woods,
        itemId: copperId,
        path,
        ticksIntoStep: 1,
      },
    });

    expect(
      inTick(() =>
        workerTripBeginReturn(kingdomWorkerTripHost(workerId), {
          itemId: copperId,
          quantity: 4,
        }),
      ),
    ).toBe(false);
    expect(workersState()[workerId].status).toEqual({ kind: 'AtDuchy' });
  });
});

describe('workerAssign', () => {
  it('assigns a valid node and starts the trip from the duchy', () => {
    seedWorker(staminaFor(tripCost()));
    seedWorkerState();
    const events = captureAnalyticsEvents();

    expect(inTick(() => workerAssign(workerId, woods, copperId))).toBe(true);
    expect(workersState()[workerId]).toMatchObject({
      assignment,
      status: { kind: 'TravelingTo', nodeName: woods },
    });
    expect(events).toEqual(['Worker:Assign:Weaver Nell']);
  });

  it('only changes the assignment for a worker already out on a trip', () => {
    seedWorker(staminaFor(tripCost()));
    seedWorkerState({
      status: {
        kind: 'TravelingBack',
        path,
        ticksIntoStep: 0,
        carriedQuantity: 0,
      },
    });

    inTick(() => workerAssign(workerId, woods, copperId));

    expect(workersState()[workerId]).toMatchObject({
      assignment,
      status: { kind: 'TravelingBack' },
    });
  });

  it('refuses an unrescued worker or an invalid assignment', () => {
    seedWorker(staminaFor(tripCost() - 1));
    seedGamestate();
    expect(inTick(() => workerAssign(workerId, woods, copperId))).toBe(false);

    seedWorkerState();
    expect(inTick(() => workerAssign(workerId, woods, copperId))).toBe(false);
    expect(workersState()[workerId].assignment).toBeNull();
  });
});

describe('workerRecall', () => {
  it('clears the assignment and sends a gathering worker home with its haul', () => {
    seedWorkerState({
      assignment,
      status: {
        kind: 'Gathering',
        nodeName: woods,
        itemId: copperId,
        itemsGathered: 3,
        ticksIntoGather: 0,
      } as WorkerState['status'],
    });
    const events = captureAnalyticsEvents();

    inTick(() => workerRecall(workerId));

    expect(workersState()[workerId]).toMatchObject({
      assignment: null,
      status: {
        kind: 'TravelingBack',
        carriedItemId: copperId,
        carriedQuantity: 3,
      },
    });
    expect(events).toEqual(['Worker:Recall:Weaver Nell']);
  });

  it('only clears the assignment for a worker already heading home or idle', () => {
    seedWorkerState({ assignment });

    inTick(() => workerRecall(workerId));

    expect(workersState()[workerId]).toMatchObject({
      assignment: null,
      status: { kind: 'AtDuchy' },
    });
    expect(travelPathFrom).not.toHaveBeenCalled();
  });

  it('leaves a worker already heading home on its way', () => {
    const headingHome: WorkerState['status'] = {
      kind: 'TravelingBack',
      path,
      ticksIntoStep: 1,
      carriedItemId: copperId,
      carriedQuantity: 2,
    };
    seedWorkerState({ assignment, status: headingHome });

    inTick(() => workerRecall(workerId));

    expect(workersState()[workerId].status).toEqual(headingHome);
    expect(travelPathFrom).not.toHaveBeenCalled();
  });
});

describe('leaving a craft', () => {
  const recipeId = 'copper-ingot' as RecipeId;
  const crafting: WorkerState['status'] = {
    kind: 'Crafting',
    recipeId,
    ticksIntoCraft: 1,
    materialsHeld: true,
  };

  function seedCrafter(): void {
    seedContent([
      ensureWorker({
        id: workerId,
        name: 'Weaver Nell',
        ...staminaFor(tripCost()),
      }),
      ensureGathering({
        id: 'woods' as GatheringId,
        name: woods,
        gatherResults: [
          ensureGatherResult({
            chance: 10,
            items: [{ itemId: copperId, quantity: 1 }],
          }),
        ],
      }),
      ensureRecipe({
        id: recipeId,
        requirements: [{ itemId: copperId, quantity: 2 }],
      }),
    ]);
    seedWorkerState({ assignment: { recipeId }, status: crafting });
  }

  it('refunds the held unit and heads out when reassigned to gather', () => {
    seedCrafter();

    inTick(() => workerAssign(workerId, woods, copperId));

    expect(getMaterialQuantity(copperId)).toBe(2);
    expect(workersState()[workerId]).toMatchObject({
      assignment,
      status: { kind: 'TravelingTo', nodeName: woods },
    });
  });

  it('parks refunded, not crafting, when the outbound route vanishes', () => {
    seedCrafter();
    vi.mocked(travelPathFrom)
      .mockReturnValueOnce(path)
      .mockReturnValueOnce(undefined);

    inTick(() => workerAssign(workerId, woods, copperId));

    expect(getMaterialQuantity(copperId)).toBe(2);
    expect(workersState()[workerId]).toMatchObject({
      assignment,
      status: { kind: 'AtDuchy' },
    });
  });

  it('only clears a pending craft assignment while heading home', () => {
    seedCrafter();
    const headingHome: WorkerState['status'] = {
      kind: 'TravelingBack',
      path,
      ticksIntoStep: 0,
      carriedQuantity: 0,
    };
    seedWorkerState({ assignment: { recipeId }, status: headingHome });

    inTick(() => workerRecall(workerId));

    expect(workersState()[workerId]).toMatchObject({
      assignment: null,
      status: headingHome,
    });
  });

  it('refunds the held unit and parks at the duchy when recalled', () => {
    seedCrafter();
    const events = captureAnalyticsEvents();

    inTick(() => workerRecall(workerId));

    expect(events).toEqual(['Worker:Recall:Weaver Nell']);

    expect(getMaterialQuantity(copperId)).toBe(2);
    expect(workersState()[workerId]).toMatchObject({
      assignment: null,
      status: { kind: 'AtDuchy' },
    });
  });
});
