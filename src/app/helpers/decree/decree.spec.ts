import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(() => 'clause-1'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-node/world-node-rewards', () => ({
  rewardKey: vi.fn((reward) => {
    if ('itemId' in reward) return `item:${reward.itemId}`;
    if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
    if ('collectibleId' in reward) return `collectible:${reward.collectibleId}`;
    return `recipe:${reward.recipeId}`;
  }),
}));

import {
  backfillDecreeClauseRiskTolerance,
  decreeClauseAdd,
  decreeClauseConflicts,
  decreeClauseReorder,
  decreeClauseSetEnabled,
  decreeClauses,
  decreeWaitForFullHealthBeforeCombat,
  pruneInvalidDecreeGatherClauses,
} from '@helpers/decree/decree';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  DecreeClause,
  DecreeClauseId,
  GameState,
  ItemId,
  MaterialId,
} from '@interfaces';

function buildClause(overrides: Partial<DecreeClause> = {}): DecreeClause {
  return {
    id: 'clause-1' as DecreeClauseId,
    type: 'FinishUnfinishedAreas',
    enabled: true,
    failureCount: 0,
    ...overrides,
  } as DecreeClause;
}

function stateWithAutoMode(
  clauses: DecreeClause[],
  waitForFullHealthBeforeCombat = false,
  nodeFailureCounts: Partial<Record<string, number>> = {},
): GameState {
  return {
    world: {
      autoMode: {
        enabled: false,
        clauses,
        waitForFullHealthBeforeCombat,
        nodeFailureCounts,
      },
    },
  } as unknown as GameState;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

describe('decree read accessors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decreeClauses returns the stored clause list', () => {
    const clauses = [buildClause()];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    expect(decreeClauses()).toBe(clauses);
  });

  it('decreeWaitForFullHealthBeforeCombat returns the stored flag', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([], true));

    expect(decreeWaitForFullHealthBeforeCombat()).toBe(true);
  });
});

describe('decreeClauseAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prepends a new enabled clause with zero failures and returns true', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([]));

    expect(decreeClauseAdd({ type: 'ReturnToKingdom' })).toBe(true);

    const result = applyLastUpdate(stateWithAutoMode([]));
    expect(result.world.autoMode.clauses).toEqual([
      {
        type: 'ReturnToKingdom',
        id: 'clause-1',
        enabled: true,
        failureCount: 0,
      },
    ]);
  });

  it('preserves existing clauses when adding another', () => {
    const existing = buildClause({ id: 'clause-0' as DecreeClauseId });
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([existing]));

    decreeClauseAdd({
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 5,
    });

    const result = applyLastUpdate(stateWithAutoMode([existing]));
    expect(result.world.autoMode.clauses).toHaveLength(2);
    expect(result.world.autoMode.clauses[1]).toBe(existing);
  });

  it('refuses to add a clause that duplicates an existing one and returns false', () => {
    const existing = buildClause({ type: 'ReturnToKingdom' });
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([existing]));

    expect(decreeClauseAdd({ type: 'ReturnToKingdom' })).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('decreeClauseConflicts', () => {
  it('flags two clauses of the same type as conflicting regardless of risk tolerance', () => {
    const existing = [
      buildClause({ type: 'LevelUpParty', riskTolerance: 'Low' }),
    ];

    expect(
      decreeClauseConflicts(
        { type: 'LevelUpParty', riskTolerance: 'High' },
        existing,
      ),
    ).toBe(true);
  });

  it('does not flag different clause types as conflicting', () => {
    const existing = [
      buildClause({ type: 'LevelUpParty', riskTolerance: 'Medium' }),
    ];

    expect(
      decreeClauseConflicts(
        { type: 'FinishUnfinishedAreas', riskTolerance: 'Medium' },
        existing,
      ),
    ).toBe(false);
  });

  it('flags two GatherMaterial clauses for the same material regardless of quantity', () => {
    const existing = [
      buildClause({
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'GatherMaterial',
          materialId: 'wood' as MaterialId,
          targetQuantity: 20,
        },
        existing,
      ),
    ).toBe(true);
  });

  it('does not flag GatherMaterial clauses for different materials', () => {
    const existing = [
      buildClause({
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'GatherMaterial',
          materialId: 'stone' as MaterialId,
          targetQuantity: 20,
        },
        existing,
      ),
    ).toBe(false);
  });

  it('flags two FarmNode clauses for the same node and reward regardless of quantity', () => {
    const existing = [
      buildClause({
        type: 'FarmNode',
        nodeName: 'Forest Ruins',
        reward: { itemId: 'bone' as ItemId },
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 5,
        },
        existing,
      ),
    ).toBe(true);
  });

  it('does not flag FarmNode clauses for the same node but a different reward', () => {
    const existing = [
      buildClause({
        type: 'FarmNode',
        nodeName: 'Forest Ruins',
        reward: { itemId: 'bone' as ItemId },
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'FarmNode',
          nodeName: 'Forest Ruins',
          reward: { itemId: 'ash' as ItemId },
          targetQuantity: 100,
        },
        existing,
      ),
    ).toBe(false);
  });

  it('flags two DefendTowns clauses targeting the same town', () => {
    const existing = [
      buildClause({
        type: 'DefendTowns',
        riskTolerance: 'Low',
        townName: 'Larsia',
      }),
    ];

    expect(
      decreeClauseConflicts(
        { type: 'DefendTowns', riskTolerance: 'High', townName: 'Larsia' },
        existing,
      ),
    ).toBe(true);
  });

  it('does not flag DefendTowns clauses targeting different towns', () => {
    const existing = [
      buildClause({
        type: 'DefendTowns',
        riskTolerance: 'Low',
        townName: 'Larsia',
      }),
    ];

    expect(
      decreeClauseConflicts(
        { type: 'DefendTowns', riskTolerance: 'Low', townName: 'Carrina' },
        existing,
      ),
    ).toBe(false);
  });

  it('flags two untargeted ("any town") DefendTowns clauses as conflicting', () => {
    const existing = [
      buildClause({ type: 'DefendTowns', riskTolerance: 'Low' }),
    ];

    expect(
      decreeClauseConflicts(
        { type: 'DefendTowns', riskTolerance: 'High' },
        existing,
      ),
    ).toBe(true);
  });

  it('does not flag FarmNode clauses for the same reward at a different node', () => {
    const existing = [
      buildClause({
        type: 'FarmNode',
        nodeName: 'Forest Ruins',
        reward: { itemId: 'bone' as ItemId },
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'FarmNode',
          nodeName: 'Old Ruins',
          reward: { itemId: 'bone' as ItemId },
          targetQuantity: 100,
        },
        existing,
      ),
    ).toBe(false);
  });
});

describe('decreeClauseSetEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flips only the matching clause', () => {
    const clauses = [
      buildClause({ id: 'clause-1' as DecreeClauseId, enabled: true }),
      buildClause({ id: 'clause-2' as DecreeClauseId, enabled: true }),
    ];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    decreeClauseSetEnabled('clause-1' as DecreeClauseId, false);

    const result = applyLastUpdate(stateWithAutoMode(clauses));
    expect(result.world.autoMode.clauses[0].enabled).toBe(false);
    expect(result.world.autoMode.clauses[1].enabled).toBe(true);
  });
});

describe('decreeClauseReorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves a clause from one index to another', () => {
    const clauses = [
      buildClause({ id: 'clause-1' as DecreeClauseId }),
      buildClause({ id: 'clause-2' as DecreeClauseId }),
      buildClause({ id: 'clause-3' as DecreeClauseId }),
    ];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    decreeClauseReorder(0, 2);

    const result = applyLastUpdate(stateWithAutoMode(clauses));
    expect(result.world.autoMode.clauses.map((c) => c.id)).toEqual([
      'clause-2',
      'clause-3',
      'clause-1',
    ]);
  });
});

describe('pruneInvalidDecreeGatherClauses', () => {
  it('drops a GatherMaterial clause whose material no GatherNode produces', () => {
    const clauses = [
      buildClause({
        type: 'GatherMaterial',
        materialId: 'wergen-stick' as MaterialId,
        targetQuantity: 1000,
      }),
    ];

    expect(pruneInvalidDecreeGatherClauses(clauses, [])).toEqual([]);
  });

  it('keeps a GatherMaterial clause whose material is still produced somewhere', () => {
    const clauses = [
      buildClause({
        type: 'GatherMaterial',
        materialId: 'copper-ore' as MaterialId,
        targetQuantity: 1000,
      }),
    ];

    expect(
      pruneInvalidDecreeGatherClauses(clauses, ['copper-ore' as MaterialId]),
    ).toEqual(clauses);
  });

  it('leaves non-GatherMaterial clauses untouched', () => {
    const clauses = [buildClause({ type: 'ReturnToKingdom' })];

    expect(pruneInvalidDecreeGatherClauses(clauses, [])).toEqual(clauses);
  });
});

describe('backfillDecreeClauseRiskTolerance', () => {
  it('applies the legacy risk tolerance to a LevelUpParty clause missing it', () => {
    const clauses = [buildClause({ type: 'LevelUpParty' })];

    expect(backfillDecreeClauseRiskTolerance(clauses, 'High')[0]).toMatchObject(
      { riskTolerance: 'High' },
    );
  });

  it('applies the legacy risk tolerance to a FinishUnfinishedAreas clause missing it', () => {
    const clauses = [buildClause({ type: 'FinishUnfinishedAreas' })];

    expect(backfillDecreeClauseRiskTolerance(clauses, 'Low')[0]).toMatchObject({
      riskTolerance: 'Low',
    });
  });

  it('does not override a risk tolerance the clause already has', () => {
    const clauses = [
      buildClause({ type: 'LevelUpParty', riskTolerance: 'Low' }),
    ];

    expect(backfillDecreeClauseRiskTolerance(clauses, 'High')[0]).toMatchObject(
      { riskTolerance: 'Low' },
    );
  });

  it('leaves clause types without a risk tolerance untouched', () => {
    const clauses = [buildClause({ type: 'ReturnToKingdom' })];

    expect(backfillDecreeClauseRiskTolerance(clauses, 'High')).toEqual(clauses);
  });
});
