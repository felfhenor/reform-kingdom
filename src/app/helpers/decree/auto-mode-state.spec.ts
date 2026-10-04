import { describe, expect, it, onTestFinished } from 'vitest';
import { analyticsEvent$ } from '@helpers/engine/analytics';

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
import { worldAutoModeState } from '@helpers/state-game';
import type { AutoModeState, DecreeClauseId } from '@interfaces';
import { decreeClause } from '@/testing/decree';
import { inTick, seedGamestate } from '@/testing/gamestate';

const clauseA = decreeClause(
  { type: 'ReturnToKingdom' },
  { id: 'a' as DecreeClauseId },
);
const clauseB = decreeClause(
  { type: 'LevelUpParty', riskTolerance: 'Low' },
  { id: 'b' as DecreeClauseId },
);

function seedAutoMode(autoMode: Partial<AutoModeState>): void {
  seedGamestate((state) => Object.assign(state.world.autoMode, autoMode));
}

const failureCounts = () =>
  worldAutoModeState().clauses.map((clause) => clause.failureCount);

describe('autoModeToggle', () => {
  it('turns Auto Mode on, and off again dropping the active clause', () => {
    seedAutoMode({ enabled: false, activeClauseId: clauseA.id });

    inTick(() => autoModeToggle(true));
    expect(autoModeIsEnabled()).toBe(true);
    expect(worldAutoModeState().activeClauseId).toBe(clauseA.id);

    inTick(() => autoModeToggle(false));
    expect(autoModeIsEnabled()).toBe(false);
    expect(worldAutoModeState().activeClauseId).toBeUndefined();
  });
});

describe('autoModeSetActiveClause', () => {
  it('sets or clears the active clause', () => {
    seedAutoMode({});

    inTick(() => autoModeSetActiveClause(clauseB.id));
    expect(worldAutoModeState().activeClauseId).toBe(clauseB.id);

    inTick(() => autoModeSetActiveClause(undefined));
    expect(worldAutoModeState().activeClauseId).toBeUndefined();
  });
});

describe('the active clause’s failure streak', () => {
  const clauses = [
    { ...clauseA, failureCount: 4 },
    { ...clauseB, failureCount: 2 },
  ];

  it('grows on each failure, for the active clause only', () => {
    seedAutoMode({ clauses, activeClauseId: clauseB.id });

    inTick(() => autoModeRecordClauseFailure());

    expect(failureCounts()).toEqual([4, 3]);
  });

  it('resets on a success, for the active clause only', () => {
    seedAutoMode({ clauses, activeClauseId: clauseB.id });

    inTick(() => autoModeRecordClauseSuccess());

    expect(failureCounts()).toEqual([4, 0]);
  });

  it('is left alone with no active clause', () => {
    seedAutoMode({ clauses });

    inTick(() => {
      autoModeRecordClauseFailure();
      autoModeRecordClauseSuccess();
    });

    expect(failureCounts()).toEqual([4, 2]);
  });
});

describe('per-node failure streaks', () => {
  it('count up per failed node and report the new streak', () => {
    seedAutoMode({ nodeFailureCounts: { A: 1, B: 4 } });
    const reported: { event: string; value: number }[] = [];
    const subscription = analyticsEvent$.subscribe((e) => reported.push(e));
    onTestFinished(() => subscription.unsubscribe());

    inTick(() => {
      autoModeRecordNodeFailure('A');
      autoModeRecordNodeFailure('New');
    });

    expect(worldAutoModeState().nodeFailureCounts).toEqual({
      A: 2,
      B: 4,
      New: 1,
    });
    expect(reported).toEqual([
      { event: 'World:Node:Fail', value: 2 },
      { event: 'World:Node:Fail', value: 1 },
    ]);
  });

  it('reset for a node on a win, and for every node on request', () => {
    seedAutoMode({ nodeFailureCounts: { A: 3, B: 4 } });

    inTick(() => autoModeRecordNodeSuccess('A'));
    expect(worldAutoModeState().nodeFailureCounts).toEqual({ A: 0, B: 4 });

    inTick(() => autoModeResetNodeFailureCounts());
    expect(worldAutoModeState().nodeFailureCounts).toEqual({});
  });
});
