import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { updateGamestate, worldAutoModeState } from '@helpers/state-game';
import type { DecreeClauseId } from '@interfaces';

export function autoModeIsEnabled(): boolean {
  return worldAutoModeState().enabled;
}

export function autoModeToggle(enabled: boolean): void {
  updateGamestate((state) => {
    state.world.autoMode.enabled = enabled;
    if (!enabled) state.world.autoMode.activeClauseId = undefined;
    return state;
  });
}

export function autoModeSetActiveClause(clauseId?: DecreeClauseId): void {
  updateGamestate((state) => {
    state.world.autoMode.activeClauseId = clauseId;
    return state;
  });
}

function updateActiveClauseFailureCount(
  nextFailureCount: (current: number) => number,
): void {
  const activeClauseId = worldAutoModeState().activeClauseId;
  if (!activeClauseId) return;

  updateGamestate((state) => {
    state.world.autoMode.clauses.forEach((clause) => {
      if (clause.id === activeClauseId) {
        clause.failureCount = nextFailureCount(clause.failureCount);
      }
    });
    return state;
  });
}

export function autoModeRecordClauseFailure(): void {
  updateActiveClauseFailureCount((count) => count + 1);
}

// A won fight proves the clause works again, so its failure streak shouldn't keep tripping the UI's warning forever.
export function autoModeRecordClauseSuccess(): void {
  updateActiveClauseFailureCount(() => 0);
}

// Recorded for every lost fight regardless of clause.
export function autoModeRecordNodeFailure(nodeName: string): void {
  let newFailureCount = 0;

  updateGamestate((state) => {
    const counts = state.world.autoMode.nodeFailureCounts;
    newFailureCount = (counts[nodeName] ?? 0) + 1;
    counts[nodeName] = newFailureCount;
    return state;
  });

  analyticsSendDesignEvent('World:Node:Fail', newFailureCount);
}

export function autoModeRecordNodeSuccess(nodeName: string): void {
  updateGamestate((state) => {
    state.world.autoMode.nodeFailureCounts[nodeName] = 0;
    return state;
  });
}

// Called on level-up so a stronger party gets a fresh try at nodes previously written off.
export function autoModeResetNodeFailureCounts(): void {
  updateGamestate((state) => {
    state.world.autoMode.nodeFailureCounts = {};
    return state;
  });
}
