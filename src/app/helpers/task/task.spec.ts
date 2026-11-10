import { beforeEach, describe, expect, it } from 'vitest';

import {
  ensureTask,
  ensureTaskRequirement,
} from '@helpers/content/ensure-task';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTrainer } from '@helpers/content/ensure-trainer';
import {
  isTaskOnRemovedNode,
  taskRequirementNodeName,
} from '@helpers/task/task';
import type { TownId, TrainerId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const TOWN = 'town-elfheim' as TownId;
const TRAINER = 'trainer-reyn' as TrainerId;

beforeEach(() => {
  seedContent([
    ensureTown({ id: TOWN, name: 'Elfheim' }),
    ensureTrainer({ id: TRAINER, name: 'Reyn Astra' }),
  ]);
});

describe('taskRequirementNodeName', () => {
  it('uses the node name directly for node requirements', () => {
    const requirement = ensureTaskRequirement({
      kind: 'ShrineLevel',
      nodeName: 'Shrine of the Founder',
    });
    expect(taskRequirementNodeName(requirement)).toBe('Shrine of the Founder');
  });

  it('resolves trainer requirements to the trainer node', () => {
    const requirement = ensureTaskRequirement({
      kind: 'LearnTeaching',
      trainerId: TRAINER,
    });
    expect(taskRequirementNodeName(requirement)).toBe('Reyn Astra');
  });

  it('resolves town requirements to the town node', () => {
    const requirement = ensureTaskRequirement({
      kind: 'TownReputationTier',
      townId: TOWN,
    });
    expect(taskRequirementNodeName(requirement)).toBe('Elfheim');
  });

  it('is undefined for requirements with no node', () => {
    const requirement = ensureTaskRequirement({ kind: 'ReachLevel' });
    expect(taskRequirementNodeName(requirement)).toBeUndefined();
  });
});

describe('isTaskOnRemovedNode', () => {
  it('is true only for tasks set at a node type removed this run', () => {
    seedWorldNodes([{ name: 'Woods', type: 'GatherNode' }]);
    const gather = ensureTask({
      requirement: ensureTaskRequirement({
        kind: 'GatherItem',
        nodeName: 'Woods',
      }),
    });
    const level = ensureTask({
      requirement: ensureTaskRequirement({ kind: 'ReachLevel' }),
    });

    seedGamestate();
    expect(isTaskOnRemovedNode(gather)).toBe(false);

    seedGamestate((state) => {
      state.globalEffectSums.removedWorldNodeTypes.GatherNode = true;
    });
    expect(isTaskOnRemovedNode(gather)).toBe(true);
    expect(isTaskOnRemovedNode(level)).toBe(false);
  });
});
