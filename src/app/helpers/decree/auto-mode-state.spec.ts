import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/engine/analytics', () => ({
  analyticsSendDesignEvent: vi.fn(),
}));

vi.mock('@helpers/state-game', () => {
  const gamestate = vi.fn();
  return {
    gamestate,
    updateGamestate: vi.fn(),
    worldAutoModeState: () => gamestate().world.autoMode,
  };
});

import {
  autoModeIsEnabled,
  autoModeRecordClauseFailure,
  autoModeRecordClauseSuccess,
  autoModeRecordNodeFailure,
  autoModeRecordNodeSuccess,
  autoModeResetNodeFailureCounts,
  autoModeSetActiveClause,
  autoModeToggle,
} from '@helpers/decree/auto-mode-state';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { DecreeClause, DecreeClauseId, GameState } from '@interfaces';

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

function buildState(overrides: {
  enabled?: boolean;
  clauses?: DecreeClause[];
  activeClauseId?: DecreeClauseId;
  nodeFailureCounts?: Partial<Record<string, number>>;
}): GameState {
  return {
    world: {
      autoMode: {
        enabled: overrides.enabled ?? true,
        clauses: overrides.clauses ?? [],
        activeClauseId: overrides.activeClauseId,
        nodeFailureCounts: overrides.nodeFailureCounts ?? {},
      },
    },
  } as unknown as GameState;
}

function applyLastUpdate(state: GameState): GameState {
  const calls = vi.mocked(updateGamestate).mock.calls;
  const updateFn = calls[calls.length - 1][0];
  return updateFn(state);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('autoModeIsEnabled / autoModeToggle', () => {
  it('reads the enabled flag from state', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({ enabled: true }));
    expect(autoModeIsEnabled()).toBe(true);
  });

  it('turning off clears the active clause', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeToggle(false);

    const result = applyLastUpdate(
      buildState({ activeClauseId: 'clause-1' as DecreeClauseId }),
    );
    expect(result.world.autoMode.enabled).toBe(false);
    expect(result.world.autoMode.activeClauseId).toBeUndefined();
  });
});

describe('autoModeSetActiveClause', () => {
  it('sets the active clause', () => {
    autoModeSetActiveClause('b' as DecreeClauseId);

    const result = applyLastUpdate(buildState({}));
    expect(result.world.autoMode.activeClauseId).toBe('b');
  });

  it('clears the active clause when given no id', () => {
    autoModeSetActiveClause(undefined);

    const result = applyLastUpdate(
      buildState({ activeClauseId: 'a' as DecreeClauseId }),
    );
    expect(result.world.autoMode.activeClauseId).toBeUndefined();
  });
});

describe('autoModeRecordClauseFailure', () => {
  it('does nothing when no clause is active', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeRecordClauseFailure();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('increments only the active clause', () => {
    const clauses = [
      buildClause({ id: 'a' as DecreeClauseId, failureCount: 0 }),
      buildClause({ id: 'b' as DecreeClauseId, failureCount: 2 }),
    ];
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );

    autoModeRecordClauseFailure();

    const result = applyLastUpdate(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'a')?.failureCount,
    ).toBe(0);
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'b')?.failureCount,
    ).toBe(3);
  });
});

describe('autoModeRecordClauseSuccess', () => {
  it('does nothing when no clause is active', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeRecordClauseSuccess();

    expect(updateGamestate).not.toHaveBeenCalled();
  });

  it('resets only the active clause failure count to zero', () => {
    const clauses = [
      buildClause({ id: 'a' as DecreeClauseId, failureCount: 4 }),
      buildClause({ id: 'b' as DecreeClauseId, failureCount: 2 }),
    ];
    vi.mocked(gamestate).mockReturnValue(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );

    autoModeRecordClauseSuccess();

    const result = applyLastUpdate(
      buildState({ clauses, activeClauseId: 'b' as DecreeClauseId }),
    );
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'a')?.failureCount,
    ).toBe(4);
    expect(
      result.world.autoMode.clauses.find((c) => c.id === 'b')?.failureCount,
    ).toBe(0);
  });
});

describe('autoModeRecordNodeFailure', () => {
  it('increments only the named node, leaving others untouched', () => {
    const nodeFailureCounts = { A: 1, B: 4 };
    vi.mocked(gamestate).mockReturnValue(buildState({ nodeFailureCounts }));

    autoModeRecordNodeFailure('A');

    const result = applyLastUpdate(buildState({ nodeFailureCounts }));
    expect(result.world.autoMode.nodeFailureCounts['A']).toBe(2);
    expect(result.world.autoMode.nodeFailureCounts['B']).toBe(4);
  });

  it('starts a node at 1 the first time it fails', () => {
    vi.mocked(gamestate).mockReturnValue(buildState({}));

    autoModeRecordNodeFailure('New');

    const result = applyLastUpdate(buildState({}));
    expect(result.world.autoMode.nodeFailureCounts['New']).toBe(1);
  });
});

describe('autoModeRecordNodeSuccess', () => {
  it('resets only the named node back to zero', () => {
    const nodeFailureCounts = { A: 3, B: 4 };
    vi.mocked(gamestate).mockReturnValue(buildState({ nodeFailureCounts }));

    autoModeRecordNodeSuccess('A');

    const result = applyLastUpdate(buildState({ nodeFailureCounts }));
    expect(result.world.autoMode.nodeFailureCounts['A']).toBe(0);
    expect(result.world.autoMode.nodeFailureCounts['B']).toBe(4);
  });
});

describe('autoModeResetNodeFailureCounts', () => {
  it('wipes every recorded node failure count', () => {
    const nodeFailureCounts = { A: 3, B: 4 };
    vi.mocked(gamestate).mockReturnValue(buildState({ nodeFailureCounts }));

    autoModeResetNodeFailureCounts();

    const result = applyLastUpdate(buildState({ nodeFailureCounts }));
    expect(result.world.autoMode.nodeFailureCounts).toEqual({});
  });
});
