import { describe, expect, it } from 'vitest';

import { characterDebuffPotency } from '@helpers/hero/hero-effect';
import type { JobId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { buildEffectNode, heroLearning } from '@/testing/skill-tree';

describe('characterDebuffPotency', () => {
  it('sums every DebuffPotency effect and ignores other kinds', () => {
    const potency = buildEffectNode('potency', [
      { kind: 'DebuffPotency', chance: 5, duration: 1 },
      { kind: 'StatPerLevel', stat: 'Strength', value: 3 },
    ]);
    const morePotency = buildEffectNode('more-potency', [
      { kind: 'DebuffPotency', chance: 5, duration: 1 },
    ]);
    seedContent([potency, morePotency]);

    expect(
      characterDebuffPotency(
        heroLearning(
          { jobId: 'job' as JobId, teachings: {}, skillTreeNodes: {} },
          potency,
          morePotency,
        ),
      ),
    ).toEqual({ chance: 10, duration: 2 });
  });

  it('is zero without any grants', () => {
    expect(
      characterDebuffPotency({
        jobId: 'job' as JobId,
        teachings: {},
        skillTreeNodes: {},
      }),
    ).toEqual({
      chance: 0,
      duration: 0,
    });
  });
});
