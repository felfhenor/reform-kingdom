import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import {
  allGatherableMaterialIds,
  gatheringEffectiveGatherTime,
  gatheringResultsAtLevel,
} from '@helpers/world-node/world-node-gathering';
import type { ItemId } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { describe, expect, it } from 'vitest';
import { seedContent } from '@/testing/content';
import { seedWorldNodes } from '@/testing/world';

const woods = 'Wergen Woods';

function gatherResult(itemId: string, levelRequirement?: number) {
  return ensureGatherResult({
    chance: 50,
    items: [{ itemId: itemId as ItemId, quantity: 1 }],
    levelRequirement,
  });
}

describe('gatheringResultsAtLevel', () => {
  it('always includes results with no levelRequirement, regardless of level', () => {
    const unrestricted = ensureGatherResult({
      chance: 40,
      items: [{ itemId: 'wood' as ItemId, quantity: 1 }],
    });
    const gathering = ensureGathering({ gatherResults: [unrestricted] });

    expect(gatheringResultsAtLevel(gathering, 0)).toEqual([unrestricted]);
    expect(gatheringResultsAtLevel(gathering, 3)).toEqual([unrestricted]);
  });

  it('only includes a level-gated result at its exact level, not earlier or later ones', () => {
    const levelOne = ensureGatherResult({
      chance: 7,
      items: [{ itemId: 'ore' as ItemId, quantity: 1 }],
      levelRequirement: 0,
    });
    const levelTwo = ensureGatherResult({
      chance: 4,
      items: [{ itemId: 'azurite' as ItemId, quantity: 1 }],
      levelRequirement: 1,
    });
    const gathering = ensureGathering({ gatherResults: [levelOne, levelTwo] });

    expect(gatheringResultsAtLevel(gathering, 0)).toEqual([levelOne]);
    expect(gatheringResultsAtLevel(gathering, 1)).toEqual([levelTwo]);
    expect(gatheringResultsAtLevel(gathering, 2)).toEqual([]);
  });
});

describe('gatheringEffectiveGatherTime', () => {
  it('reduces gatherTime by the per-upgrade amount for each node level', () => {
    const gathering = ensureGathering({
      gatherTime: 10,
      gatherReductionPerUpgradeLevel: 2,
    });

    expect(gatheringEffectiveGatherTime(gathering, 0)).toBe(10);
    expect(gatheringEffectiveGatherTime(gathering, 3)).toBe(4);
  });

  it('never drops below 1 tick', () => {
    const gathering = ensureGathering({
      gatherTime: 5,
      gatherReductionPerUpgradeLevel: 3,
    });

    expect(gatheringEffectiveGatherTime(gathering, 4)).toBe(1);
  });

  it('defaults to no reduction when unset', () => {
    const gathering = ensureGathering({ gatherTime: 5 });

    expect(gatheringEffectiveGatherTime(gathering, 2)).toBe(5);
  });
});

describe('allGatherableMaterialIds', () => {
  it('includes materials from GatherNodes the player has not discovered', () => {
    seedContent([
      ensureGathering({
        name: woods,
        gatherResults: [
          ensureGatherResult({
            chance: 100,
            items: [
              { itemId: 'wood' as ItemId, quantity: 1 },
              { itemId: 'sap' as ItemId, quantity: 1 },
            ],
          }),
        ],
      }),
    ]);
    seedWorldNodes([{ name: woods, type: 'GatherNode' }]);

    expect(sortBy(allGatherableMaterialIds())).toEqual(['sap', 'wood']);
  });

  it('returns nothing when no GatherNodes exist', () => {
    seedContent([
      ensureGathering({ name: woods, gatherResults: [gatherResult('wood')] }),
    ]);
    seedWorldNodes([{ name: woods, type: 'ExploreNode' }]);

    expect(allGatherableMaterialIds()).toEqual([]);
  });

  // Decree clause pruning must keep a clause for a material that just isn't unlocked yet.
  it("includes a level-gated material regardless of the node's current level", () => {
    seedContent([
      ensureGathering({
        name: woods,
        gatherResults: [gatherResult('wood'), gatherResult('azurite', 3)],
      }),
    ]);
    seedWorldNodes([{ name: woods, type: 'GatherNode' }]);

    expect(sortBy(allGatherableMaterialIds())).toEqual(['azurite', 'wood']);
  });
});
