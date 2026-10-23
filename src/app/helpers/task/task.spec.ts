import { beforeEach, describe, expect, it } from 'vitest';

import { ensureTaskRequirement } from '@helpers/content/ensure-task';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTrainer } from '@helpers/content/ensure-trainer';
import { taskRequirementNodeName } from '@helpers/task/task';
import type { TownId, TrainerId } from '@interfaces';
import { seedContent } from '@/testing/content';

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
