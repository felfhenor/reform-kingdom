import { describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntriesByType: vi.fn(),
}));

import { getEntriesByType } from '@helpers/content';
import { runGatherDevelopmentLevelsAnalysis } from '@helpers/debug/analysis-gatherdevelopmentlevels';
import type { GatheringContent } from '@interfaces';

function buildGathering(
  overrides: Partial<GatheringContent> = {},
): GatheringContent {
  return {
    id: 'gather-1' as never,
    name: 'Carrina Copper Mines',
    __type: 'gathering',
    description: 'test',
    levelRange: { min: 1, max: 5 },
    xpGainedIfInLevelRange: 3,
    gatherTime: 5,
    gatherResults: [],
    hidden: false,
    workerLevelRange: { min: 1, max: 99 },
    maxLevel: 3,
    levelCostScalar: 10000,
    ...overrides,
  };
}

describe('runGatherDevelopmentLevelsAnalysis', () => {
  it('passes when every development level has at least one available result', () => {
    const gathering = buildGathering({
      maxLevel: 3,
      gatherResults: [
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 1 }], levelRequirement: 0 },
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 2 }], levelRequirement: 1 },
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 3 }], levelRequirement: 2 },
      ],
    });
    vi.mocked(getEntriesByType).mockReturnValue([gathering]);

    const result = runGatherDevelopmentLevelsAnalysis();

    expect(result.checks).toEqual([
      expect.objectContaining({ status: 'pass' }),
    ]);
    expect(result.summary).toContain('Every gather node');
  });

  it('passes for a node with only unrestricted (always-available) results', () => {
    const gathering = buildGathering({
      maxLevel: 5,
      gatherResults: [
        { chance: 40, items: [{ itemId: 'wood' as never, quantity: 1 }] },
      ],
    });
    vi.mocked(getEntriesByType).mockReturnValue([gathering]);

    const result = runGatherDevelopmentLevelsAnalysis();

    expect(result.checks[0].status).toBe('pass');
  });

  it('fails a level with zero matching results - reproduces the Carrina gap where level 4 is skipped', () => {
    const gathering = buildGathering({
      maxLevel: 5,
      gatherResults: [
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 1 }], levelRequirement: 0 },
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 2 }], levelRequirement: 1 },
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 3 }], levelRequirement: 2 },
        { chance: 7, items: [{ itemId: 'ore' as never, quantity: 4 }], levelRequirement: 3 },
        // level 4 has no matching entry - levelRequirement 3 is reused by mistake.
      ],
    });
    vi.mocked(getEntriesByType).mockReturnValue([gathering]);

    const result = runGatherDevelopmentLevelsAnalysis();

    expect(result.checks[0].status).toBe('fail');
    expect(result.checks[0].message).toContain('level(s) 4');
    expect(result.summary).toContain('1 gather node(s)');
  });
});
