import { describe, expect, it } from 'vitest';

import { characterDebuffPotency } from '@helpers/hero/hero-effect';

describe('characterDebuffPotency', () => {
  it('sums every DebuffPotency effect and ignores other kinds', () => {
    expect(
      characterDebuffPotency({
        teachings: {},
        debugEffects: [
          { kind: 'DebuffPotency', chance: 5, duration: 1 },
          { kind: 'DebuffPotency', chance: 5, duration: 1 },
          { kind: 'StatPerLevel', stat: 'Strength', value: 3 },
        ],
      }),
    ).toEqual({ chance: 10, duration: 2 });
  });

  it('is zero without any grants', () => {
    expect(characterDebuffPotency({ teachings: {} })).toEqual({
      chance: 0,
      duration: 0,
    });
  });
});
