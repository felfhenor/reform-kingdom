import { autoModePatch } from '@helpers/decree/auto-mode-state';
import { deepFreeze } from '@helpers/engine/deep-freeze';
import type { AutoModeState, DecreeClauseId, GameState } from '@interfaces';
import { describe, expect, it } from 'vitest';

function buildState(): GameState {
  const autoMode: AutoModeState = {
    enabled: false,
    clauses: [],
    activeClauseId: 'clause-1' as DecreeClauseId,
    waitForFullHealthBeforeCombat: false,
    waitForFullEnergyBeforeCombat: false,
    nodeFailureCounts: {},
  };

  return { world: { autoMode } } as unknown as GameState;
}

describe('autoModePatch', () => {
  it('reassigns the autoMode object instead of mutating the frozen original', () => {
    const state = buildState();
    const previous = deepFreeze(state.world.autoMode);

    autoModePatch(state, { enabled: true });

    expect(state.world.autoMode).not.toBe(previous);
    expect(state.world.autoMode.enabled).toBe(true);
    expect(previous.enabled).toBe(false);
  });

  it('keeps untouched fields reference-stable', () => {
    const state = buildState();
    const previous = deepFreeze(state.world.autoMode);

    autoModePatch(state, { enabled: true });

    expect(state.world.autoMode.clauses).toBe(previous.clauses);
    expect(state.world.autoMode.nodeFailureCounts).toBe(
      previous.nodeFailureCounts,
    );
  });

  it('clears a field when patched with an explicit undefined', () => {
    const state = buildState();

    autoModePatch(state, { activeClauseId: undefined });

    expect(state.world.autoMode.activeClauseId).toBeUndefined();
  });
});
