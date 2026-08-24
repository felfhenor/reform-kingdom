import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/decree/decree', () => ({
  decreeNodeFailureCount: vi.fn(() => 0),
  decreeWaitForFullHealthBeforeCombat: vi.fn(() => false),
}));

vi.mock('@helpers/decree/decree-farm-node', () => ({
  farmNodeRewardQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/item/gather-node-discovery', () => ({
  isGatherNodeDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/item/gathering', () => ({
  partyMaxLevel: vi.fn(() => 10),
  partyMinLevel: vi.fn(() => 10),
}));

vi.mock('@helpers/item/materials', () => ({
  getMaterialQuantity: vi.fn(() => 0),
}));

vi.mock('@helpers/combat/monster', () => ({
  isXpTrivialAtOverLevel: vi.fn(() => false),
}));

vi.mock('@helpers/hero/party', () => ({
  CHARACTER_MAX_LEVEL: 99,
  isPartyAtFullHealth: vi.fn(() => true),
}));

vi.mock('@helpers/pathfinding/pathfinding', () => ({
  travelPathTo: vi.fn(),
}));

vi.mock('@helpers/world', () => ({
  isPlayerAtKingdom: vi.fn(() => false),
}));

vi.mock('@helpers/world-node/world-node-gathering', () => ({
  worldNodeGatherMaterialIds: vi.fn(() => []),
}));

vi.mock('@helpers/world-node/world-node-rewards', () => ({
  worldNodeCompletionRewardProgress: vi.fn(() => ({ obtained: 0, total: 0 })),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  isWorldNodeVisible: vi.fn(() => true),
  worldNodeByName: vi.fn(),
  worldNodeEncounter: vi.fn(),
  worldNodesOfType: vi.fn(() => []),
}));

import { isXpTrivialAtOverLevel } from '@helpers/combat/monster';
import {
  decreeNodeFailureCount,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import {
  clauseTargetNode,
  isClauseBlockedOnlyByHealth,
  isClauseSatisfiable,
  LEVEL_UP_NODE_FAILURE_LIMIT,
  mostChallengingExploreNodeForRisk,
  nearestGatherNodeFor,
  nearestUnfinishedExploreNode,
  pickNextClause,
  riskLevelOfExploreNode,
  riskLevelSatisfies,
} from '@helpers/decree/decree-evaluation';
import { farmNodeRewardQuantity } from '@helpers/decree/decree-farm-node';
import { isPartyAtFullHealth } from '@helpers/hero/party';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { partyMaxLevel, partyMinLevel } from '@helpers/item/gathering';
import { getMaterialQuantity } from '@helpers/item/materials';
import { travelPathTo } from '@helpers/pathfinding/pathfinding';
import { isPlayerAtKingdom } from '@helpers/world';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering';
import { worldNodeCompletionRewardProgress } from '@helpers/world-node/world-node-rewards';
import {
  isWorldNodeVisible,
  worldNodeByName,
  worldNodeEncounter,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  EncounterContent,
  ItemId,
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
    riskTolerance: 'Medium',
    ...overrides,
  } as DecreeClause;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(partyMinLevel).mockReturnValue(10);
  vi.mocked(partyMaxLevel).mockReturnValue(10);
  vi.mocked(isXpTrivialAtOverLevel).mockReturnValue(false);
  vi.mocked(worldNodesOfType).mockReturnValue([]);
  vi.mocked(worldNodeByName).mockReturnValue(undefined);
  vi.mocked(isWorldNodeVisible).mockReturnValue(true);
  vi.mocked(travelPathTo).mockReturnValue(undefined);
  vi.mocked(isPlayerAtKingdom).mockReturnValue(false);
  vi.mocked(getMaterialQuantity).mockReturnValue(0);
  vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
  vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(false);
  vi.mocked(isPartyAtFullHealth).mockReturnValue(true);
  vi.mocked(farmNodeRewardQuantity).mockReturnValue(0);
  vi.mocked(decreeNodeFailureCount).mockReturnValue(0);
});

describe('riskLevelOfExploreNode', () => {
  it('is Low when the node is at or below the party level', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 5, max: 10 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('Low');
  });

  it('is Medium when the party can already clear the floor but not the ceiling', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 8, max: 12 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('Medium');
  });

  it('is High when the floor itself is above the party, within the hard cap', () => {
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 16, max: 18 },
    } as EncounterContent);

    expect(riskLevelOfExploreNode(buildNode('A'))).toBe('High');
  });

  it('is High rather than Medium when the floor is only slightly above the party', () => {
    // A near floor alone isn't enough for Medium; the party must clear the floor outright.
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 13, max: 16 },
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

    expect(nearestUnfinishedExploreNode('High')).toBe(near);
  });

  it('ignores fully-looted nodes', () => {
    const node = buildNode('Done');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 2,
      total: 2,
    });
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });

  it('excludes candidates outside the given risk tolerance', () => {
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

    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });

  it('excludes a hidden node that has not been discovered', () => {
    const node = buildNode('Hidden');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeCompletionRewardProgress).mockReturnValue({
      obtained: 0,
      total: 1,
    });
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

    expect(nearestUnfinishedExploreNode('High')).toBeUndefined();
  });
});

describe('mostChallengingExploreNodeForRisk', () => {
  it('accepts a node at or below the given risk tolerance', () => {
    const node = buildNode('Safe');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 5, max: 5 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(mostChallengingExploreNodeForRisk('Low')).toBe(node);
  });

  it('excludes a node above the given risk tolerance', () => {
    const node = buildNode('TooRisky');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 16, max: 16 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(mostChallengingExploreNodeForRisk('Medium')).toBeUndefined();
  });

  it('prefers the more challenging reachable node over a nearer, easier one', () => {
    const near = buildNode('Near');
    const far = buildNode('Far');
    vi.mocked(worldNodesOfType).mockReturnValue([near, far]);
    vi.mocked(worldNodeEncounter).mockImplementation(
      (entry) =>
        ({
          Near: { levelRange: { min: 1, max: 1 } },
          Far: { levelRange: { min: 10, max: 10 } },
        })[entry.nodeName] as EncounterContent,
    );
    // Near is one hop away, Far is much further - distance shouldn't matter.
    vi.mocked(travelPathTo).mockImplementation((name) =>
      name === 'Near' ? [{} as never] : [{} as never, {} as never, {} as never],
    );

    expect(mostChallengingExploreNodeForRisk('Medium')).toBe(far);
  });

  it('falls back to an easier node when the toughest one is unreachable', () => {
    const near = buildNode('Near');
    const unreachable = buildNode('Unreachable');
    vi.mocked(worldNodesOfType).mockReturnValue([near, unreachable]);
    vi.mocked(worldNodeEncounter).mockImplementation(
      (entry) =>
        ({
          Near: { levelRange: { min: 1, max: 1 } },
          Unreachable: { levelRange: { min: 10, max: 10 } },
        })[entry.nodeName] as EncounterContent,
    );
    vi.mocked(travelPathTo).mockImplementation((name) =>
      name === 'Near' ? [] : undefined,
    );

    expect(mostChallengingExploreNodeForRisk('Medium')).toBe(near);
  });

  it('prefers a comparable (same-tier) node with fewer failures over one that keeps losing', () => {
    const losing = buildNode('Losing');
    const comparable = buildNode('Comparable');
    vi.mocked(worldNodesOfType).mockReturnValue([losing, comparable]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 10, max: 10 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeNodeFailureCount).mockImplementation((nodeName) =>
      nodeName === 'Losing' ? 2 : 0,
    );

    expect(mostChallengingExploreNodeForRisk('High')).toBe(comparable);
  });

  it('steps down a tier once every node in it has hit the failure limit', () => {
    const hard = buildNode('Hard');
    const easy = buildNode('Easy');
    vi.mocked(worldNodesOfType).mockReturnValue([hard, easy]);
    vi.mocked(worldNodeEncounter).mockImplementation(
      (entry) =>
        ({
          Hard: { levelRange: { min: 10, max: 10 } },
          Easy: { levelRange: { min: 1, max: 1 } },
        })[entry.nodeName] as EncounterContent,
    );
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeNodeFailureCount).mockImplementation((nodeName) =>
      nodeName === 'Hard' ? LEVEL_UP_NODE_FAILURE_LIMIT : 0,
    );

    expect(mostChallengingExploreNodeForRisk('High')).toBe(easy);
  });

  it('falls back to the least-failed node overall once every tier has hit the limit', () => {
    const hard = buildNode('Hard');
    const easy = buildNode('Easy');
    vi.mocked(worldNodesOfType).mockReturnValue([hard, easy]);
    vi.mocked(worldNodeEncounter).mockImplementation(
      (entry) =>
        ({
          Hard: { levelRange: { min: 10, max: 10 } },
          Easy: { levelRange: { min: 1, max: 1 } },
        })[entry.nodeName] as EncounterContent,
    );
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(decreeNodeFailureCount).mockImplementation((nodeName) =>
      nodeName === 'Hard'
        ? LEVEL_UP_NODE_FAILURE_LIMIT + 3
        : LEVEL_UP_NODE_FAILURE_LIMIT,
    );

    expect(mostChallengingExploreNodeForRisk('High')).toBe(easy);
  });

  it('excludes a node that would only give 1 XP due to over-level', () => {
    const trivial = buildNode('Trivial');
    const worthwhile = buildNode('Worthwhile');
    vi.mocked(worldNodesOfType).mockReturnValue([trivial, worthwhile]);
    vi.mocked(worldNodeEncounter).mockImplementation(
      (entry) =>
        ({
          Trivial: { levelRange: { min: 1, max: 1 } },
          Worthwhile: { levelRange: { min: 10, max: 10 } },
        })[entry.nodeName] as EncounterContent,
    );
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isXpTrivialAtOverLevel).mockImplementation(
      (_partyLevel, nodeMaxLevel) => nodeMaxLevel === 1,
    );

    expect(mostChallengingExploreNodeForRisk('High')).toBe(worthwhile);
  });

  it('fails when every reachable node would only give 1 XP', () => {
    const trivial = buildNode('Trivial');
    vi.mocked(worldNodesOfType).mockReturnValue([trivial]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 1, max: 1 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isXpTrivialAtOverLevel).mockReturnValue(true);

    expect(mostChallengingExploreNodeForRisk('High')).toBeUndefined();
  });

  it('excludes a hidden node that has not been discovered', () => {
    const node = buildNode('Hidden');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeEncounter).mockReturnValue({
      levelRange: { min: 5, max: 5 },
    } as EncounterContent);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

    expect(mostChallengingExploreNodeForRisk('High')).toBeUndefined();
  });
});

describe('nearestGatherNodeFor', () => {
  it('is unaffected by risk tolerance', () => {
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

  it('excludes a hidden node that has not been discovered, even if visited', () => {
    const node = buildNode('Grove');
    vi.mocked(worldNodesOfType).mockReturnValue([node]);
    vi.mocked(worldNodeGatherMaterialIds).mockReturnValue([
      'wood' as MaterialId,
    ]);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isGatherNodeDiscovered).mockReturnValue(true);
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

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

    expect(isClauseSatisfiable(buildClause({ type: 'LevelUpParty' }))).toBe(
      false,
    );
  });

  it('ReturnToKingdom is unsatisfiable once already at the kingdom', () => {
    vi.mocked(isPlayerAtKingdom).mockReturnValue(true);

    expect(isClauseSatisfiable(buildClause({ type: 'ReturnToKingdom' }))).toBe(
      false,
    );
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

    expect(isClauseSatisfiable(buildClause({ type: 'LevelUpParty' }))).toBe(
      false,
    );
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
    expect(isClauseSatisfiable(buildClause({ type: 'ReturnToKingdom' }))).toBe(
      true,
    );
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
      pickNextClause([buildClause({ type: 'ReturnToKingdom' })]),
    ).toBeUndefined();
  });
});

describe('clauseTargetNode', () => {
  it('has no node target for ReturnToKingdom', () => {
    expect(
      clauseTargetNode(buildClause({ type: 'ReturnToKingdom' })),
    ).toBeUndefined();
  });

  it('FarmNode targets its stored node when reachable', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);

    expect(
      clauseTargetNode(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 10,
        }),
      ),
    ).toBe(node);
  });

  it('FarmNode has no target when its node no longer exists', () => {
    vi.mocked(worldNodeByName).mockReturnValue(undefined);

    expect(
      clauseTargetNode(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Gone',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 10,
        }),
      ),
    ).toBeUndefined();
  });

  it('FarmNode has no target when its node is unreachable', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue(undefined);

    expect(
      clauseTargetNode(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 10,
        }),
      ),
    ).toBeUndefined();
  });

  it('FarmNode has no target when its node is hidden and undiscovered', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(isWorldNodeVisible).mockReturnValue(false);

    expect(
      clauseTargetNode(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 10,
        }),
      ),
    ).toBeUndefined();
  });
});

describe('isClauseSatisfiable - FarmNode', () => {
  it('is satisfiable when the reward is short of target and the node is reachable', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(farmNodeRewardQuantity).mockReturnValue(2);

    expect(
      isClauseSatisfiable(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 5,
        }),
      ),
    ).toBe(true);
  });

  it('is unsatisfiable once the target quantity is already met', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(farmNodeRewardQuantity).mockReturnValue(5);

    expect(
      isClauseSatisfiable(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 5,
        }),
      ),
    ).toBe(false);
  });

  it('is blocked while waiting for full health', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(farmNodeRewardQuantity).mockReturnValue(0);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    expect(
      isClauseSatisfiable(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 5,
        }),
      ),
    ).toBe(false);
  });
});

describe('isClauseBlockedOnlyByHealth - FarmNode', () => {
  it('is true when short of target, reachable, and only blocked by health', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(farmNodeRewardQuantity).mockReturnValue(0);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    expect(
      isClauseBlockedOnlyByHealth(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 5,
        }),
      ),
    ).toBe(true);
  });

  it('is false once the target quantity is already met', () => {
    const node = buildNode('Forest Ruins');
    vi.mocked(worldNodeByName).mockReturnValue(node);
    vi.mocked(travelPathTo).mockReturnValue([]);
    vi.mocked(farmNodeRewardQuantity).mockReturnValue(5);
    vi.mocked(decreeWaitForFullHealthBeforeCombat).mockReturnValue(true);
    vi.mocked(isPartyAtFullHealth).mockReturnValue(false);

    expect(
      isClauseBlockedOnlyByHealth(
        buildClause({
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 5,
        }),
      ),
    ).toBe(false);
  });
});
