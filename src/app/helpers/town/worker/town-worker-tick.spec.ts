import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/worker/town-worker-auto-assign');
vi.mock('@helpers/town/worker/town-worker-gathering');
vi.mock('@helpers/town/worker/town-worker-travel-tick');

import { ensureTown } from '@helpers/content/ensure-town';
import { uniq } from 'es-toolkit/compat';
import { townWorkerAutoAssign } from '@helpers/town/worker/town-worker-auto-assign';
import { townWorkerGatheringProcessTick } from '@helpers/town/worker/town-worker-gathering';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import { townWorkerProcessTick } from '@helpers/town/worker/town-worker-tick';
import {
  townWorkerRestProcessTick,
  townWorkerTravelProcessTick,
} from '@helpers/town/worker/town-worker-travel-tick';
import type {
  ItemId,
  TownId,
  TownNodeState,
  TownWorkerState,
  TownWorkerStatus,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const workerId = 'darwin' as WorkerId;
const town = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });
const assignment = { nodeName: 'Copper Mine', itemId: 'ore' as ItemId };

function seedWorker(
  overrides: Partial<TownWorkerState> = {},
  townState: Partial<TownNodeState> = {},
): void {
  seedGamestate((state) => {
    state.world.towns[town.id] = buildTownNodeState({
      ...townState,
      workers: {
        [workerId]: { ...defaultTownWorkerState(town, 3), ...overrides },
      },
    });
  });
}

const travel = { path: [], ticksIntoStep: 0 };
const statuses: { status: TownWorkerStatus; processor: Mock }[] = [
  {
    status: { kind: 'TravelingTo', ...travel, ...assignment },
    processor: vi.mocked(townWorkerTravelProcessTick),
  },
  {
    status: { kind: 'TravelingBack', ...travel, carriedQuantity: 0 },
    processor: vi.mocked(townWorkerTravelProcessTick),
  },
  {
    status: {
      kind: 'Gathering',
      ...assignment,
      itemsGathered: 0,
      ticksIntoGather: 0,
    },
    processor: vi.mocked(townWorkerGatheringProcessTick),
  },
  {
    status: { kind: 'Resting', ticksIntoRest: 0 },
    processor: vi.mocked(townWorkerRestProcessTick),
  },
];

const processors = () => uniq(statuses.map((s) => s.processor));

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([town]);
});

describe('townWorkerProcessTick', () => {
  it('auto-assigns an idle worker at its own level', () => {
    seedWorker();

    townWorkerProcessTick();

    expect(townWorkerAutoAssign).toHaveBeenCalledWith(town, workerId, 3);
  });

  it('leaves an idle worker that already has an assignment alone', () => {
    seedWorker({ assignment });

    townWorkerProcessTick();

    [townWorkerAutoAssign, ...statuses.map((s) => s.processor)].forEach((fn) =>
      expect(fn).not.toHaveBeenCalled(),
    );
  });

  it.each(statuses)(
    'advances a $status.kind worker',
    ({ status, processor }) => {
      seedWorker({ status, assignment });

      townWorkerProcessTick();

      expect(processor).toHaveBeenCalledExactlyOnceWith(town, workerId);
      [townWorkerAutoAssign, ...processors()]
        .filter((fn) => fn !== processor)
        .forEach((fn) => expect(fn).not.toHaveBeenCalled());
    },
  );

  it('skips a town already processed this tick', () => {
    seedWorker({}, { lastProcessedTick: { worker: 0 } });

    townWorkerProcessTick();

    expect(townWorkerAutoAssign).not.toHaveBeenCalled();
  });
});
