import { describe, expect, it } from 'vitest';

import { ensureTown } from '@helpers/content/ensure-town';
import { defaultTownWorkerState } from '@helpers/town/worker/town-worker-progression';
import {
  pruneInvalidTownWorkers,
  townWorkerRosterMaterialize,
  townWorkers,
} from '@helpers/town/worker/town-worker-roster';
import type { TownId, WorkerId } from '@interfaces';
import { seedContent } from '@/testing/content';

const darwinId = 'darwin' as WorkerId;
const talbotId = 'talbot' as WorkerId;
const roster = [
  { workerId: darwinId, level: 1 },
  { workerId: talbotId, level: 2 },
];
const town = ensureTown({
  id: 'larsia' as TownId,
  name: 'Larsia',
  gathering: { workers: roster },
});

describe('townWorkers', () => {
  it('reads the town’s roster, empty for a town gone from content', () => {
    seedContent([town]);
    expect(townWorkers(town.id)).toEqual(roster);

    seedContent([]);
    expect(townWorkers(town.id)).toEqual([]);
  });
});

describe('townWorkerRosterMaterialize', () => {
  it('gives each roster worker without state a fresh one at its listed level', () => {
    const progressed = { ...defaultTownWorkerState(town, 1), level: 9 };

    expect(
      townWorkerRosterMaterialize(town, { [darwinId]: progressed }),
    ).toEqual({
      [darwinId]: progressed,
      [talbotId]: defaultTownWorkerState(town, 2),
    });
  });
});

describe('pruneInvalidTownWorkers', () => {
  it('drops state for workers no longer on the roster', () => {
    const kept = defaultTownWorkerState(town, 1);

    expect(
      pruneInvalidTownWorkers(town, {
        [darwinId]: kept,
        ['removed' as WorkerId]: defaultTownWorkerState(town, 1),
      }),
    ).toEqual({ [darwinId]: kept });
  });
});
