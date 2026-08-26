import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  gatherMessageLog: vi.fn(),
  itemDropHtml: vi.fn(
    (item: { name: string }, quantity: number) => `${quantity} ${item.name}`,
  ),
}));

vi.mock('@helpers/hero/travel', () => ({
  travelStepTicksCost: vi.fn(() => 1),
}));

vi.mock('@helpers/item/materials', () => ({
  addMaterial: vi.fn(),
}));

vi.mock('@helpers/worker/worker-travel', () => ({
  workerAssignmentIsValid: vi.fn(() => true),
  workerBeginOutboundTrip: vi.fn(),
}));

import { gatherMessageLog, itemDropHtml } from '@helpers/combat/combat-log';
import { getEntry } from '@helpers/content';
import { addMaterial } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerAssignmentIsValid,
  workerBeginOutboundTrip,
} from '@helpers/worker/worker-travel';
import { workerTravelProcessTick } from '@helpers/worker/worker-travel-tick';
import type {
  GameState,
  ItemContent,
  ItemId,
  WorkerContent,
  WorkerId,
  WorkerState,
} from '@interfaces';

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

const WORKER_ID = 'weaver-nell' as WorkerId;
const COPPER_ID = 'copper-ore' as ItemId;

const workerContent: WorkerContent = {
  id: WORKER_ID,
  name: 'Weaver Nell',
  __type: 'worker',
  description: 'test',
  sprite: '0000',
  frames: 4,
  baseStats: { capacity: 6, gatherSpeed: 1, stamina: 30 },
  statsPerLevel: { capacity: 0.5, gatherSpeed: 0.1, stamina: 2 },
};

const copperContent = { id: COPPER_ID, name: 'Copper Ore' } as ItemContent;

function buildReturningWorker(
  overrides: Partial<WorkerState> = {},
): WorkerState {
  return {
    level: 1,
    xp: { current: 0, maximum: 10 },
    location: { mapName: 'Carrina', x: 0, y: 0 },
    status: {
      kind: 'TravelingBack',
      path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
      ticksIntoStep: 0,
      carriedItemId: COPPER_ID,
      carriedQuantity: 5,
    },
    assignment: null,
    ...overrides,
  };
}

describe('workerTravelProcessTick - TravelingBack arrival', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntry).mockImplementation((id: unknown) => {
      if (id === WORKER_ID) return workerContent as never;
      if (id === COPPER_ID) return copperContent as never;
      return undefined;
    });
  });

  it('grants the carried material and logs a return message on arrival', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildReturningWorker() },
    } as unknown as GameState);

    workerTravelProcessTick(WORKER_ID);

    expect(addMaterial).toHaveBeenCalledWith(COPPER_ID, 5);
    expect(itemDropHtml).toHaveBeenCalledWith(copperContent, 5);
    expect(gatherMessageLog).toHaveBeenCalledWith(
      'Worker Resources',
      'Weaver Nell returned with 5 Copper Ore.',
    );

    const result = applyLastUpdate({
      workers: { [WORKER_ID]: buildReturningWorker() },
    } as unknown as GameState);
    expect(result.workers[WORKER_ID].status).toEqual({ kind: 'AtDuchy' });
  });

  it('still grants the material but skips the log when the worker/item content no longer resolves', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);
    vi.mocked(gamestate).mockReturnValue({
      workers: { [WORKER_ID]: buildReturningWorker() },
    } as unknown as GameState);

    workerTravelProcessTick(WORKER_ID);

    expect(addMaterial).toHaveBeenCalledWith(COPPER_ID, 5);
    expect(gatherMessageLog).not.toHaveBeenCalled();
  });

  it('does not log or grant materials when nothing was carried', () => {
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildReturningWorker({
          status: {
            kind: 'TravelingBack',
            path: [{ kind: 'Move', mapName: 'Carrina', x: 1, y: 0 }],
            ticksIntoStep: 0,
            carriedItemId: undefined,
            carriedQuantity: 0,
          },
        }),
      },
    } as unknown as GameState);

    workerTravelProcessTick(WORKER_ID);

    expect(addMaterial).not.toHaveBeenCalled();
    expect(gatherMessageLog).not.toHaveBeenCalled();
  });

  it('redeploys on a still-valid pending assignment instead of logging a fresh trip', () => {
    const assignment = { nodeName: 'Wergen Woods', itemId: COPPER_ID };
    vi.mocked(gamestate).mockReturnValue({
      workers: {
        [WORKER_ID]: buildReturningWorker({ assignment }),
      },
    } as unknown as GameState);

    workerTravelProcessTick(WORKER_ID);

    expect(workerAssignmentIsValid).toHaveBeenCalledWith(
      WORKER_ID,
      1,
      assignment,
    );
    expect(workerBeginOutboundTrip).toHaveBeenCalledWith(WORKER_ID, assignment);
  });
});
