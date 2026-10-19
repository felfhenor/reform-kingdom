import { describe, expect, it } from 'vitest';

import { characterDebuffPotency } from '@helpers/hero/hero-effect';
import type { JobId } from '@interfaces';

describe('characterDebuffPotency', () => {
  it('sums every DebuffPotency effect and ignores other kinds', () => {
    expect(
      characterDebuffPotency({
        jobId: 'job' as JobId,
        teachings: {},
        skillTreeNodes: {},
        debugEffects: [
          { kind: 'DebuffPotency', chance: 5, duration: 1 },
          { kind: 'DebuffPotency', chance: 5, duration: 1 },
          { kind: 'StatPerLevel', stat: 'Strength', value: 3 },
        ],
      }),
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
