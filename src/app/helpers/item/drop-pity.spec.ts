import type * as RngHelper from '@helpers/rng';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', async (importOriginal) => {
  const actual = await importOriginal<typeof RngHelper>();
  return { ...actual, rngNumberRange: vi.fn(actual.rngNumberRange) };
});

import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import {
  dropPityKey,
  dropPityKeyIsValid,
  dropPityRollCompletionRewards,
} from '@helpers/item/drop-pity';
import { rngNumberRange } from '@helpers/rng';
import { dropPityState } from '@helpers/state-game';
import type { CollectibleId } from '@interfaces';

const nodeName = 'Forest Ruins';
const clam = ensureDroppedReward({
  collectibleId: 'swamp-clam' as CollectibleId,
  chance: 10,
});
const pearl = ensureDroppedReward({
  collectibleId: 'pearl' as CollectibleId,
  chance: 100,
});
const relic = ensureDroppedReward({
  collectibleId: 'relic' as CollectibleId,
  chance: 10,
  minLevel: 20,
});
const clamKey = dropPityKey(nodeName, clam);

function clear(): number {
  return inTick(
    () =>
      dropPityRollCompletionRewards(nodeName, [clam, pearl, relic], 1).length,
  );
}

beforeEach(() => {
  seedGamestate();
  vi.mocked(rngNumberRange).mockReturnValue(12);
});

describe('dropPityRollCompletionRewards', () => {
  it('adds a point per miss until the drop lands, then clears it', () => {
    expect([clear(), clear(), clear()]).toEqual([1, 1, 1]);
    expect(dropPityState()[clamKey]).toBe(3);

    expect(clear()).toBe(2);
    expect(dropPityState()[clamKey]).toBeUndefined();
  });

  it('skips guaranteed and out-of-level drops', () => {
    clear();
    expect(Object.keys(dropPityState())).toEqual([clamKey]);
  });
});

describe('dropPityKeyIsValid', () => {
  beforeEach(() => {
    seedWorldNodes([{ name: nodeName, type: 'ExploreNode' }]);
    seedContent([
      ensureEncounter({ name: nodeName, completionRewards: [clam] }),
    ]);
  });

  it('keeps a reward still on its node', () => {
    expect(dropPityKeyIsValid(clamKey)).toBe(true);
  });

  it('drops a reward no longer on the node, or a missing node', () => {
    expect(dropPityKeyIsValid(dropPityKey(nodeName, pearl))).toBe(false);
    expect(dropPityKeyIsValid(dropPityKey('Gone', clam))).toBe(false);
  });
});
