import { beforeEach, describe, expect, it } from 'vitest';

import { TOWN_WORKER_REST_TICKS } from '@helpers/config';
import { ensureTown } from '@helpers/content/ensure-town';
import { worldTownsState } from '@helpers/state-game';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import { townWorkerRestProcessTick } from '@helpers/town/worker/town-worker-travel-tick';
import type {
  TownContent,
  TownId,
  TownWorkerState,
  TownWorkerStatus,
  WorkerId,
} from '@interfaces';
import { buildTownNodeState } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';

const workerId = 'darwin' as WorkerId;

const larsia: TownContent = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
});

function seedWorker(status: TownWorkerStatus): void {
  seedGamestate((state) => {
    state.world.towns[larsia.id] = buildTownNodeState({
      workers: {
        [workerId]: { ...defaultTownWorkerState(larsia, 1), status },
      },
    });
  });
}

function worker(): TownWorkerState {
  return worldTownsState()[larsia.id].workers[workerId];
}

beforeEach(() => {
  seedContent([larsia]);
});

describe('townWorkerRestProcessTick', () => {
  const restTick = () =>
    inTick(() => townWorkerRestProcessTick(larsia, workerId));

  it('rests for the configured ticks, then is back at town', () => {
    seedWorker({ kind: 'Resting', ticksIntoRest: 0 });

    restTick();
    expect(worker().status).toEqual({ kind: 'Resting', ticksIntoRest: 1 });

    seedWorker({ kind: 'Resting', ticksIntoRest: TOWN_WORKER_REST_TICKS - 2 });
    restTick();
    expect(worker().status.kind).toBe('Resting');
    restTick();
    expect(worker().status).toEqual({ kind: 'AtTown' });
  });
});
