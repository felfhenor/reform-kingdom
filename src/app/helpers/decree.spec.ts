import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/content', () => ({
  getEntry: vi.fn(),
}));

vi.mock('@helpers/rng', () => ({
  rngUuid: vi.fn(() => 'clause-1'),
}));

vi.mock('@helpers/state-game', () => ({
  gamestate: vi.fn(),
  updateGamestate: vi.fn(),
}));

vi.mock('@helpers/world-nodes', () => ({
  rewardContentInfo: vi.fn(),
  rewardKey: vi.fn((reward) => {
    if ('itemId' in reward) return `item:${reward.itemId}`;
    if ('equipmentId' in reward) return `equipment:${reward.equipmentId}`;
    if ('collectibleId' in reward) return `collectible:${reward.collectibleId}`;
    return `recipe:${reward.recipeId}`;
  }),
}));

import { getEntry } from '@helpers/content';
import {
  decreeClauseAdd,
  decreeClauseConflicts,
  decreeClauseReorder,
  decreeClauseRemove,
  decreeClauseSetEnabled,
  decreeClauseSummary,
  decreeClauseUpdate,
  decreeClauses,
  decreeRiskTolerance,
  decreeSetRiskTolerance,
  decreeSetWaitForFullHealthBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree';
import { gamestate, updateGamestate } from '@helpers/state-game';
import { rewardContentInfo } from '@helpers/world-nodes';
import type {
  DecreeClause,
  DecreeClauseId,
  GameState,
  ItemContent,
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
  riskTolerance: 'Low' | 'Medium' | 'High' = 'Medium',
  waitForFullHealthBeforeCombat = false,
  nodeFailureCounts: Partial<Record<string, number>> = {},
): GameState {
  return {
    world: {
      autoMode: {
        enabled: false,
        clauses,
        riskTolerance,
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

  it('decreeRiskTolerance returns the stored risk tolerance', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([], 'High'));

    expect(decreeRiskTolerance()).toBe('High');
  });

  it('decreeWaitForFullHealthBeforeCombat returns the stored flag', () => {
    vi.mocked(gamestate).mockReturnValue(
      stateWithAutoMode([], 'Medium', true),
    );

    expect(decreeWaitForFullHealthBeforeCombat()).toBe(true);
  });
});

describe('decreeSetWaitForFullHealthBeforeCombat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the stored flag', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([]));

    decreeSetWaitForFullHealthBeforeCombat(true);

    const result = applyLastUpdate(stateWithAutoMode([]));
    expect(result.world.autoMode.waitForFullHealthBeforeCombat).toBe(true);
  });
});

describe('decreeClauseAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends a new enabled clause with zero failures and returns true', () => {
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

    decreeClauseAdd({ type: 'GatherMaterial', materialId: 'wood' as MaterialId, targetQuantity: 5 });

    const result = applyLastUpdate(stateWithAutoMode([existing]));
    expect(result.world.autoMode.clauses).toHaveLength(2);
    expect(result.world.autoMode.clauses[0]).toBe(existing);
  });

  it('refuses to add a clause that duplicates an existing one and returns false', () => {
    const existing = buildClause({ type: 'ReturnToKingdom' });
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([existing]));

    expect(decreeClauseAdd({ type: 'ReturnToKingdom' })).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });
});

describe('decreeClauseConflicts', () => {
  it('flags two param-less clauses of the same type as conflicting', () => {
    const existing = [buildClause({ type: 'LevelUpParty' })];

    expect(decreeClauseConflicts({ type: 'LevelUpParty' }, existing)).toBe(
      true,
    );
  });

  it('does not flag different clause types as conflicting', () => {
    const existing = [buildClause({ type: 'LevelUpParty' })];

    expect(
      decreeClauseConflicts({ type: 'FinishUnfinishedAreas' }, existing),
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

describe('decreeClauseUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces the action fields while keeping id, enabled, and failureCount', () => {
    const existing = buildClause({
      id: 'clause-1' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 20,
      enabled: false,
      failureCount: 2,
    });
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([existing]));

    expect(
      decreeClauseUpdate('clause-1' as DecreeClauseId, {
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 100,
      }),
    ).toBe(true);

    const result = applyLastUpdate(stateWithAutoMode([existing]));
    expect(result.world.autoMode.clauses).toEqual([
      {
        id: 'clause-1',
        type: 'GatherMaterial',
        materialId: 'wood',
        targetQuantity: 100,
        enabled: false,
        failureCount: 2,
      },
    ]);
  });

  it('keeps the clause at its original position in the list', () => {
    const clauses = [
      buildClause({ id: 'a' as DecreeClauseId, type: 'ReturnToKingdom' }),
      buildClause({
        id: 'b' as DecreeClauseId,
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 20,
      }),
      buildClause({ id: 'c' as DecreeClauseId, type: 'LevelUpParty' }),
    ];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    decreeClauseUpdate('b' as DecreeClauseId, {
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 500,
    });

    const result = applyLastUpdate(stateWithAutoMode(clauses));
    expect(result.world.autoMode.clauses.map((c) => c.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('does not leave stale fields behind when the new action drops them', () => {
    const existing = buildClause({
      id: 'clause-1' as DecreeClauseId,
      type: 'GatherMaterial',
      materialId: 'wood' as MaterialId,
      targetQuantity: 20,
    });
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([existing]));

    decreeClauseUpdate('clause-1' as DecreeClauseId, {
      type: 'FinishUnfinishedAreas',
    });

    const result = applyLastUpdate(stateWithAutoMode([existing]));
    expect(result.world.autoMode.clauses[0]).toEqual({
      id: 'clause-1',
      type: 'FinishUnfinishedAreas',
      enabled: true,
      failureCount: 0,
    });
  });

  it('returns false and makes no change for an unknown clause id', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([]));

    expect(
      decreeClauseUpdate('missing' as DecreeClauseId, {
        type: 'ReturnToKingdom',
      }),
    ).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('refuses an update that would duplicate a different existing clause', () => {
    const clauses = [
      buildClause({
        id: 'a' as DecreeClauseId,
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 100,
      }),
      buildClause({
        id: 'b' as DecreeClauseId,
        type: 'GatherMaterial',
        materialId: 'stone' as MaterialId,
        targetQuantity: 20,
      }),
    ];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    expect(
      decreeClauseUpdate('b' as DecreeClauseId, {
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 20,
      }),
    ).toBe(false);
    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('allows an update that keeps the clause matching itself (not a conflict with its own prior state)', () => {
    const clauses = [
      buildClause({
        id: 'a' as DecreeClauseId,
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 100,
      }),
    ];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    expect(
      decreeClauseUpdate('a' as DecreeClauseId, {
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 250,
      }),
    ).toBe(true);
  });
});

describe('decreeClauseRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes the matching clause', () => {
    const clauses = [
      buildClause({ id: 'clause-1' as DecreeClauseId }),
      buildClause({ id: 'clause-2' as DecreeClauseId }),
    ];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    decreeClauseRemove('clause-1' as DecreeClauseId);

    const result = applyLastUpdate(
      stateWithAutoMode(clauses) as unknown as GameState,
    );
    expect(result.world.autoMode.clauses.map((c) => c.id)).toEqual([
      'clause-2',
    ]);
  });

  it('clears activeClauseId when the active clause is removed', () => {
    const clauses = [buildClause({ id: 'clause-1' as DecreeClauseId })];
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode(clauses));

    decreeClauseRemove('clause-1' as DecreeClauseId);

    const state = stateWithAutoMode(clauses);
    state.world.autoMode.activeClauseId = 'clause-1' as DecreeClauseId;
    const result = applyLastUpdate(state);
    expect(result.world.autoMode.activeClauseId).toBeUndefined();
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

describe('decreeSetRiskTolerance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the stored risk tolerance', () => {
    vi.mocked(gamestate).mockReturnValue(stateWithAutoMode([]));

    decreeSetRiskTolerance('High');

    const result = applyLastUpdate(stateWithAutoMode([]));
    expect(result.world.autoMode.riskTolerance).toBe('High');
  });
});

describe('decreeClauseSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('describes a GatherMaterial clause using the material name', () => {
    vi.mocked(getEntry).mockReturnValue({
      name: 'Wood',
    } as ItemContent);

    const summary = decreeClauseSummary(
      buildClause({
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        targetQuantity: 200,
      }),
    );

    expect(summary).toBe('Gather Wood until 200 in storage');
  });

  it('falls back to a generic label when the material has no content entry', () => {
    vi.mocked(getEntry).mockReturnValue(undefined);

    const summary = decreeClauseSummary(
      buildClause({
        type: 'GatherMaterial',
        materialId: 'unknown' as MaterialId,
        targetQuantity: 5,
      }),
    );

    expect(summary).toBe('Gather materials until 5 in storage');
  });

  it('describes a FarmNode clause using the reward name', () => {
    vi.mocked(rewardContentInfo).mockReturnValue({
      name: 'Bone',
      sprite: '0001',
      spritesheet: 'item',
    });

    const summary = decreeClauseSummary(
      buildClause({
        type: 'FarmNode',
        nodeName: 'Forest Ruins',
        reward: { itemId: 'bone' as ItemId },
        targetQuantity: 20,
      }),
    );

    expect(summary).toBe('Farm Forest Ruins until 20x Bone obtained');
  });

  it('falls back to a generic label when the reward has no content entry', () => {
    vi.mocked(rewardContentInfo).mockReturnValue(undefined);

    const summary = decreeClauseSummary(
      buildClause({
        type: 'FarmNode',
        nodeName: 'Forest Ruins',
        reward: { itemId: 'unknown' as ItemId },
        targetQuantity: 5,
      }),
    );

    expect(summary).toBe('Farm Forest Ruins until 5x reward obtained');
  });

  it('describes FinishUnfinishedAreas', () => {
    expect(
      decreeClauseSummary(buildClause({ type: 'FinishUnfinishedAreas' })),
    ).toBe('Finish unfinished areas');
  });

  it('describes LevelUpParty', () => {
    expect(
      decreeClauseSummary(buildClause({ type: 'LevelUpParty' })),
    ).toBe('Level up the party');
  });

  it('describes ReturnToKingdom', () => {
    expect(
      decreeClauseSummary(buildClause({ type: 'ReturnToKingdom' })),
    ).toBe('Return to the kingdom');
  });
});
