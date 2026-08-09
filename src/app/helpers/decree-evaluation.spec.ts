import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/decree', () => ({
  decreeRiskTolerance: vi.fn(() => 'High'),
  decreeWaitForFullHealthBeforeCombat: vi.fn(() => false),
}));

vi.mock('@helpers/gather-node-discovery', () => ({
  isGatherNodeDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/gathering', () => ({
  partyMinLevel: vi.fn(() => 10),
}));

vi.mock('@helpers/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/party', () => ({
  CHARACTER_MAX_LEVEL: 99,
  isPartyAtFullHealth: vi.fn(() => true),
}));

vi.mock('@helpers/pathfinding', () => ({
  travelPathTo: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  isPlayerAtKingdom: vi.fn(() => false),
}));

vi.mock('@helpers/world-nodes', () => ({
  worldNodeCompletionRewardProgress: vi.fn(() => ({ obtained: 0, total: 0 })),
  worldNodeEncounter: vi.fn(),
  worldNodeGatherMaterialIds: vi.fn(() => []),
  worldNodesOfType: vi.fn(() => []),
}));

import {
  decreeRiskTolerance,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree';
import {
  clauseTargetNode,
  isClauseSatisfiable,
  mostChallengingExploreNodeForRisk,
  nearestGatherNodeFor,
  nearestUnfinishedExploreNode,
  pickNextClause,
  riskLevelOfExploreNode,
  riskLevelSatisfies,
} from '@helpers/decree-evaluation';
import { isGatherNodeDiscovered } from '@helpers/gather-node-discovery';
import { partyMinLevel } from '@helpers/gathering';
import { getMaterialQuantity } from '@helpers/materials';
import { isPartyAtFullHealth } from '@helpers/party';
import { travelPathTo } from '@helpers/pathfinding';
import { isPlayerAtKingdom } from '@helpers/world';
import {
  worldNodeCompletionRewardProgress,
  worldNodeEncounter,
  worldNodeGatherMaterialIds,
  worldNodesOfType,
} from '@helpers/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  EncounterContent,
  MaterialId,
  WorldNodeEntry,
} from '@interfaces';

function buildNode(nodeName: string): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 0,
    y: 0,
    nodeName,
    nodeData: { type: 'ExploreNode' } as never,
  };
}

function buildClause(overrides: Partial<DecreeClause> = {}): DecreeClause {
  return {
    id: 'clause-1' as DecreeClauseId,
    type: 'FinishUnfinishedAreas',
    enabled: true,
    failureCount: 0,
    ...overrides,
  } as DecreeClause;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(partyMinLevel).mockReturnValue(10);
  vi.mocked(decreeRiskTolerance).mockReturnValue('High');
  vi.mocked(worldNodesOfType).mockReturnValue([]);
  vi.mocked(travelPathTo).mockReturnValue(undefined);
  vi.mocked(isPlayerAtKingdom).mockReturnValue(false);
  vi.mocked(getMaterialQuantity).mockReturnValue(0);
  vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
  vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(false);
  vi.mocked(isPartyAtFullHealth).mockReturnValue(true);
});

describe('riskLevelOfExploreNode', () => {
  it('is Low when the node is at or below the party level', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 5, max: 10 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('Low');
  });

  it('is Medium within 1-3 levels above the party', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 12, max: 14 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('Medium');
  });

  it('is High within 4-7 levels above the party', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 16, max: 18 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('High');
  });

  it('is TooHigh beyond 7 levels above the party', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 18, max: 20 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('TooHigh');
  });

  it('is TooHigh when the node has no encounter content', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue(undefined);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('TooHigh');
  });
});

describe('riskLevelSatisfies', () => {
  it('accepts a band at or below the ceiling', () => {
    expect(riskLevelSatisfies('Low', 'High')).toBe(true);
    expect(riskLevelSatisfies('Medium', 'Medium')).toBe(true);
  });

  it('rejects a band above the ceiling', () => {
    expect(riskLevelSatisfies('High', 'Medium')).toBe(false);
  });

  it('always rejects TooHigh regardless of ceiling', () => {
    expect(riskLevelSatisfies('TooHigh', 'High')).toBe(false);
  });
});

describe('nearestUnfinishedExploreNode', () => {
  it('picks the reachable unfinished node with the shortest path', () => {
    const near = buildNode('Near');
    const far = buildNode('Far');
    vi.mocked(worldNodesOfType).mockReturnValue([far, near]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 0,
      total: 1,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockImplementation((name) =>
      name === 'Near' ? [{} as never] : [{} as never, {} as never],
    );

    expect(nearestUnfinishedExploreNode()).toBe(near);
  });

  it('ignores fully-looted nodes', () => {
    const node = buildNode('Done');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 2,
      total: 2,
    });
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(nearestUnfinishedExploreNode()).toBeUndefined();
  });

  it('excludes candidates outside the global risk tolerance', () => {
    const node = buildNode('TooRisky');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 0,
      total: 1,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 30, max: 30 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeRiskTolerance).mockReturnValue('High');

    expect(nearestUnfinishedExploreNode()).toBeUndefined();
  });
});

describe('mostChallengingExploreNodeForRisk', () => {
  it('accepts a node at or below the global risk tolerance', () => {
    vi.mocked(decreeRiskTolerance).mockReturnValue('Low');
    const node = buildNode('Safe');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 5, max: 5 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(mostChallengingExploreNodeForRisk()).toBe(node);
  });

  it('excludes a node above the global risk tolerance', () => {
    const node = buildNode('TooRisky');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 16, max: 16 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeRiskTolerance).mockReturnValue('Medium');

    expect(mostChallengingExploreNodeForRisk()).toBeUndefined();
  });

  it('prefers the more challenging reachable node over a nearer, easier one', () => {
    const near = buildNode('Near');
    const far = buildNode('Far');
    vi.mocked(worldNodesOfType).mockReturnValue([near, far]);
    vi.mocked(decreeRiskTolerance).mockReturnValue('Medium');
    vi.mocked(worldNodeEncounter).mockImplementation((entry) =>
      ({
        Near: { levelRange: { min: 1, max: 1 } },
        Far: { levelRange: { min: 10, max: 10 } },
      })[entry.nodeName] as EncounterContent,
    );
    // Near is one hop away, Far is much further - distance shouldn't matter.
    vi.mocked(travelPathTo).mockImplementation((name) =>
      name === 'Near' ? [{} as never] : [{} as never, {} as never, {} as never],
    );

    expect(mostChallengingExploreNodeForRisk()).toBe(far);
  });

  it('falls back to an easier node when the toughest one is unreachable', () => {
    const near = buildNode('Near');
    const unreachable = buildNode('Unreachable');
    vi.mocked(worldNodesOfType).mockReturnValue([near, unreachable]);
    vi.mocked(decreeRiskTolerance).mockReturnValue('Medium');
    vi.mocked(worldNodeEncounter).mockImplementation((entry) =>
      ({
        Near: { levelRange: { min: 1, max: 1 } },
        Unreachable: { levelRange: { min: 10, max: 10 } },
      })[entry.nodeName] as EncounterContent,
    );
    vi.mocked(travelPathTo).mockImplementation((name) =>
      name === 'Near' ? [] : undefined,
    );

    expect(mostChallengingExploreNodeForRisk()).toBe(near);
  });
});

describe('nearestGatherNodeFor', () => {
  it('is unaffected by risk tolerance', () => {
    vi.mocked(decreeRiskTolerance).mockReturnValue('Low');
    const node = buildNode('Grove');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'wood' as MaterialId,
    ]);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(nearestGatherNodeFor('wood' as MaterialId)).toBe(node);
  });

  it('only considers nodes that yield the requested material', () => {
    const node = buildNode('StoneQuarry');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'stone' as MaterialId,
    ]);

    expect(nearestGatherNodeFor('wood' as MaterialId)).toBeUndefined();
  });

  it('excludes nodes the player has not discovered yet', () => {
    const node = buildNode('Grove');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'wood' as MaterialId,
    ]);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(false);

    expect(nearestGatherNodeFor('wood' as MaterialId)).toBeUndefined();
  });
});

describe('isClauseSatisfiable', () => {
  it('is always false for a disabled clause', () => {
    expect(
      isClauseSatisfiable(
        buildClause({ type: 'ReturnToKingdom', enabled: false }),
      ),
    ).toBe(false);
  });

  it('GatherMaterial is satisfiable when stock is short and a node is reachable', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(2);
    const node = buildNode('Grove');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'wood' as MaterialId,
    ]);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(
      isClauseSatisfiable(
        buildClause({
          type: 'GatherMaterial',
          materialId: 'wood' as MaterialId,
          targetQuantity: 5,
        }),
      ),
    ).toBe(true);
  });

  it('GatherMaterial is unsatisfiable once the target quantity is already met', () => {
    vi.mocked(getMaterialQuantity).mockReturnValue(5);

    expect(
      isClauseSatisfiable(
        buildClause({
          type: 'GatherMaterial',
          materialId: 'wood' as MaterialId,
          targetQuantity: 5,
        }),
      ),
    ).toBe(false);
  });

  it('LevelUpParty is unsatisfiable once the party is max level', () => {
    vi.mocked(partyMinLevel).mockReturnValue(99);
    const node = buildNode('Anywhere');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 99, max: 99 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(
      isClauseSatisfiable(buildClause({ type: 'LevelUpParty' })),
    ).toBe(false);
  });

  it('ReturnToKingdom is unsatisfiable once already at the kingdom', () => {
    vi.mocked(isPlayerAtKingdom).mockReturnValue(true);

    expect(
      isClauseSatisfiable(buildClause({ type: 'ReturnToKingdom' })),
    ).toBe(false);
  });

  it('FinishUnfinishedAreas is blocked while waiting for full health', () => {
    const node = buildNode('Anywhere');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 0,
      total: 1,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    expect(
      isClauseSatisfiable(buildClause({ type: 'FinishUnfinishedAreas' })),
    ).toBe(false);
  });

  it('LevelUpParty is blocked while waiting for full health', () => {
    const node = buildNode('Anywhere');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    expect(
      isClauseSatisfiable(buildClause({ type: 'LevelUpParty' })),
    ).toBe(false);
  });

  it('the health wait does not block GatherMaterial or ReturnToKingdom', () => {
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);
    vi.mocked(getMaterialQuantity).mockReturnValue(2);
    const node = buildNode('Grove');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'wood' as MaterialId,
    ]);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(
      isClauseSatisfiable(
        buildClause({
          type: 'GatherMaterial',
          materialId: 'wood' as MaterialId,
          targetQuantity: 5,
        }),
      ),
    ).toBe(true);
    expect(
      isClauseSatisfiable(buildClause({ type: 'ReturnToKingdom' })),
    ).toBe(true);
  });

  it('a healthy party is unaffected by the wait-for-health setting', () => {
    const node = buildNode('Anywhere');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 0,
      total: 1,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(true);

    expect(
      isClauseSatisfiable(buildClause({ type: 'FinishUnfinishedAreas' })),
    ).toBe(true);
  });
});

describe('pickNextClause', () => {
  it('returns the first satisfiable clause in priority order', () => {
    vi.mocked(isPlayerAtKingdom).mockReturnValue(true); // ReturnToKingdom unsatisfiable

    const clauses = [
      buildClause({ id: 'a' as DecreeClauseId, type: 'ReturnToKingdom' }),
      buildClause({ id: 'b' as DecreeClauseId, type: 'FinishUnfinishedAreas' }),
    ];
    vi.mocked(worldNodesOfType).mockReturnValue([buildNode('Somewhere')]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 0,
      total: 1,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(pickNextClause(clauses)?.id).toBe('b');
  });

  it('returns undefined when nothing is satisfiable', () => {
    vi.mocked(isPlayerAtKingdom).mockReturnValue(true);

    expect(
      pickNextClause([
        buildClause({ type: 'ReturnToKingdom' }),
      ]),
    ).toBeUndefined();
  });
});

describe('clauseTargetNode', () => {
  it('has no node target for ReturnToKingdom', () => {
    expect(
      clauseTargetNode(buildClause({ type: 'ReturnToKingdom' })),
    ).toBeUndefined();
  });
});
