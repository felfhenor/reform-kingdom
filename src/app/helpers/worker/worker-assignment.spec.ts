import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/pathfinding/pathfinding-travel');

import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { travelPathBaseTotalTicks } from '@helpers/hero/travel-cost-base';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import {
  canWorkerReachNode,
  workerAssignmentIsValid,
  workerGatherAssignmentIsValid,
  workerStaminaCostToNode,
} from '@helpers/worker/worker-assignment';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  GatheringId,
  ItemId,
  TravelStep,
  WorkerContent,
  WorkerId,
  WorldNodeEntry,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
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

function seedDiscovered(): void {
  seedGamestate((state) => {
    state.workers[workerId] = defaultWorkerState();
    state.discoveredGatherNodes[woods] = { foundAt: 1 };
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

describe('workerStaminaCostToNode / canWorkerReachNode', () => {
  it('is the base cost of the one-way trip from the kingdom', () => {
    expect(workerStaminaCostToNode(woods)).toBe(tripCost());
    expect(canWorkerReachNode(woods, tripCost())).toBe(true);
    expect(canWorkerReachNode(woods, tripCost() - 1)).toBe(false);
  });

  it('is unreachable when no route resolves', () => {
    vi.mocked(travelPathFrom).mockReturnValue(undefined);

    expect(workerStaminaCostToNode(woods)).toBeUndefined();
    expect(canWorkerReachNode(woods, 9999)).toBe(false);
  });
});

describe('workerGatherAssignmentIsValid', () => {
  it('needs a discovered node that yields the item, within stamina', () => {
    seedWorker(staminaFor(tripCost()));
    seedDiscovered();

    expect(workerGatherAssignmentIsValid(workerId, 1, assignment)).toBe(true);
    expect(
      workerGatherAssignmentIsValid(workerId, 1, {
        ...assignment,
        itemId: 'gold' as ItemId,
      }),
    ).toBe(false);
  });

  it('is invalid when the trip exceeds stamina or the node is undiscovered', () => {
    seedWorker(staminaFor(tripCost() - 1));
    seedDiscovered();
    expect(workerGatherAssignmentIsValid(workerId, 1, assignment)).toBe(false);

    seedWorker(staminaFor(tripCost()));
    seedGamestate();
    expect(workerGatherAssignmentIsValid(workerId, 1, assignment)).toBe(false);
  });

  it("routes with the worker's canUseTeleports flag", () => {
    seedWorker({ canUseTeleports: false });
    seedDiscovered();

    workerGatherAssignmentIsValid(workerId, 1, assignment);

    expect(travelPathFrom).toHaveBeenCalledWith(duchy, woods, false);
  });
});

describe('workerAssignmentIsValid', () => {
  it('judges a gather assignment by the gather rules', () => {
    seedWorker(staminaFor(tripCost()));
    seedDiscovered();
    expect(workerAssignmentIsValid(workerId, 1, assignment)).toBe(true);

    seedWorker(staminaFor(tripCost() - 1));
    expect(workerAssignmentIsValid(workerId, 1, assignment)).toBe(false);
  });
});
