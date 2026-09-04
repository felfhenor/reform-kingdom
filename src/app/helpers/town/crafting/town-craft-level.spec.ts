import { describe, expect, it } from 'vitest';

import { townTradeskillLeveledUp } from '@helpers/town/crafting/town-craft-level';
import type { TownTradeskillState } from '@interfaces';

function buildBuilding(
  overrides: Partial<TownTradeskillState> = {},
): TownTradeskillState {
  return {
    level: 1,
    xp: { current: 0, maximum: 10 },
    ...overrides,
  };
}

describe('townTradeskillLeveledUp', () => {
  it('accumulates xp without leveling when under the maximum', () => {
    const result = townTradeskillLeveledUp(buildBuilding(), 5, 20);

    expect(result.level).toBe(1);
    expect(result.xp.current).toBe(5);
  });

  it('levels up once xp reaches the maximum, carrying over the remainder', () => {
    const result = townTradeskillLeveledUp(
      buildBuilding({ xp: { current: 8, maximum: 10 } }),
      5,
      20,
    );

    expect(result.level).toBe(2);
    expect(result.xp.current).toBe(3);
  });

  it('can level up multiple times from one large xp grant', () => {
    const result = townTradeskillLeveledUp(
      buildBuilding({ xp: { current: 0, maximum: 10 } }),
      1000,
      20,
    );

    expect(result.level).toBeGreaterThan(2);
  });

  it('never levels past the town-authored maxLevel, clamping xp at the cap', () => {
    const result = townTradeskillLeveledUp(
      buildBuilding({ level: 3, xp: { current: 9, maximum: 10 } }),
      1000,
      3,
    );

    expect(result.level).toBe(3);
    expect(result.xp.current).toBe(result.xp.maximum);
  });
});
