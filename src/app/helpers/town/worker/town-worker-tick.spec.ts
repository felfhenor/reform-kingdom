import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
}));

vi.mock('@helpers/town/town-tick', () => ({
  isTownDueForUpdate: vi.fn(),
  markTownSubsystemProcessed: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-auto-assign', () => ({
  townWorkerAutoAssign: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-gathering', () => ({
  townWorkerGatheringProcessTick: vi.fn(),
}));

vi.mock('@helpers/town/worker/town-worker-travel-tick', () => ({
  townWorkerRestProcessTick: vi.fn(),
  townWorkerTravelProcessTick: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import { townWorkerAutoAssign } from '@helpers/town/worker/town-worker-auto-assign';
import { townWorkerGatheringProcessTick } from '@helpers/town/worker/town-worker-gathering';
import { townWorkerProcessTick } from '@helpers/town/worker/town-worker-tick';
import {
  townWorkerRestProcessTick,
  townWorkerTravelProcessTick,
} from '@helpers/town/worker/town-worker-travel-tick';
import type { GameState, TownContent, TownId, WorkerId } from '@interfaces';

const townId = 'larsia' as TownId;
const workerId = 'darwin' as WorkerId;

function buildTown(): TownContent {
  return { id: townId, name: 'Larsia' } as TownContent;
}

function mockWorkerStatus(kind: string, assignment: unknown = null): void {
  vi.mocked(gamestate).mockReturnValue({
    world: {
      towns: {
        [townId]: {
          workers: { [workerId]: { status: { kind }, assignment } },
        },
      },
    },
  } as unknown as GameState);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEntriesByType).mockReturnValue([buildTown()]);
  vi.mocked(isTownDueForUpdate).mockReturnValue(true);
});

describe('townWorkerProcessTick', () => {
  it('skips a town that is not due for the worker subsystem', () => {
    vi.mocked(isTownDueForUpdate).mockReturnValue(false);
    mockWorkerStatus('AtTown');

    townWorkerProcessTick();

    expect(markTownSubsystemProcessed).not.toHaveBeenCalled();
    expect(townWorkerAutoAssign).not.toHaveBeenCalled();
  });

  it('auto-assigns an idle AtTown worker with no assignment', () => {
    mockWorkerStatus('AtTown', null);

    townWorkerProcessTick();

    expect(townWorkerAutoAssign).toHaveBeenCalledWith(
      buildTown(),
      workerId,
      undefined,
    );
    expect(markTownSubsystemProcessed).toHaveBeenCalledWith(townId, 'worker');
  });

  it('does not auto-assign an AtTown worker that already has an assignment', () => {
    mockWorkerStatus('AtTown', { nodeName: 'x', itemId: 'y' });

    townWorkerProcessTick();

    expect(townWorkerAutoAssign).not.toHaveBeenCalled();
  });

  it.each(['TravelingTo', 'TravelingBack'])(
    'dispatches %s workers to townWorkerTravelProcessTick',
    (kind) => {
      mockWorkerStatus(kind);

      townWorkerProcessTick();

      expect(townWorkerTravelProcessTick).toHaveBeenCalledWith(
        buildTown(),
        workerId,
      );
    },
  );

  it('dispatches Gathering workers to townWorkerGatheringProcessTick', () => {
    mockWorkerStatus('Gathering');

    townWorkerProcessTick();

    expect(townWorkerGatheringProcessTick).toHaveBeenCalledWith(
      buildTown(),
      workerId,
    );
  });

  it('dispatches Resting workers to townWorkerRestProcessTick', () => {
    mockWorkerStatus('Resting');

    townWorkerProcessTick();

    expect(townWorkerRestProcessTick).toHaveBeenCalledWith(
      buildTown(),
      workerId,
    );
  });
});
