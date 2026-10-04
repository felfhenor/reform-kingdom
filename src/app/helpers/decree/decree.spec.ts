import { describe, expect, it } from 'vitest';

import { DECREE_CLAUSE_CAP } from '@helpers/config';
import {
  backfillDecreeClauseRiskTolerance,
  decreeClauseAdd,
  decreeClauseCap,
  decreeClauseConflicts,
  decreeClauseReorder,
  decreeClauseSetEnabled,
  decreeClauses,
  decreeNodeFailureCount,
  decreeWaitForFullEnergyBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
  pruneInvalidDecreeGatherClauses,
} from '@helpers/decree/decree';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  GameState,
  ItemId,
  MaterialId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { decreeClause } from '@/testing/decree';
import { inTick, seedGamestate } from '@/testing/gamestate';

const withId = (id: string, action: DecreeClauseAction) =>
  decreeClause(action, { id: id as DecreeClauseId });

function seedDecree(
  clauses: DecreeClause[],
  edit?: (state: GameState) => void,
): void {
  seedGamestate((state) => {
    state.world.autoMode.clauses = clauses;
    edit?.(state);
  });
}

const clauseIds = () => decreeClauses().map((clause) => clause.id);

// Clauses that never conflict with each other, to fill the decree up to its cap.
const distinctClauses = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    withId(`clause-${i}`, {
      type: 'DefendTowns',
      riskTolerance: 'Low',
      townName: `Town ${i}`,
    }),
  );

describe('decree settings', () => {
  it('reads the clause list, health/energy waits and per-node failure streaks', () => {
    const clauses = [decreeClause({ type: 'ReturnToKingdom' })];
    seedDecree(clauses, (state) => {
      state.world.autoMode.waitForFullHealthBeforeCombat = true;
      state.world.autoMode.nodeFailureCounts = { Ruins: 3 };
    });

    expect(decreeClauses()).toEqual(clauses);
    expect(decreeWaitForFullHealthBeforeCombat()).toBe(true);
    expect(decreeWaitForFullEnergyBeforeCombat()).toBe(false);
    expect(decreeNodeFailureCount('Ruins')).toBe(3);
    expect(decreeNodeFailureCount('Elsewhere')).toBe(0);
  });
});

describe('decreeClauseCap', () => {
  it('adds any global effect boost to the base cap', () => {
    seedDecree([]);
    expect(decreeClauseCap()).toBe(DECREE_CLAUSE_CAP);

    seedDecree(
      [],
      (state) => (state.globalEffectSums.decreeClauseCapBoost = 2),
    );
    expect(decreeClauseCap()).toBe(DECREE_CLAUSE_CAP + 2);
  });
});

describe('decreeClauseAdd', () => {
  it('puts a new enabled clause with no failures at the top', () => {
    const existing = withId('existing', {
      type: 'LevelUpParty',
      riskTolerance: 'Low',
    });
    seedDecree([existing]);
    const events = captureAnalyticsEvents();

    expect(inTick(() => decreeClauseAdd({ type: 'ReturnToKingdom' }))).toBe(
      true,
    );

    expect(decreeClauses()).toEqual([
      {
        type: 'ReturnToKingdom',
        id: expect.any(String),
        enabled: true,
        failureCount: 0,
      },
      existing,
    ]);
    expect(events).toEqual(['Decree:Clause:Add']);
  });

  it('refuses a clause that conflicts with one already in the decree', () => {
    seedDecree([decreeClause({ type: 'ReturnToKingdom' })]);

    expect(inTick(() => decreeClauseAdd({ type: 'ReturnToKingdom' }))).toBe(
      false,
    );
    expect(decreeClauses()).toHaveLength(1);
  });

  it('refuses a clause once the decree is at its cap, boosts included', () => {
    seedDecree(distinctClauses(DECREE_CLAUSE_CAP));
    expect(inTick(() => decreeClauseAdd({ type: 'ReturnToKingdom' }))).toBe(
      false,
    );
    expect(decreeClauses()).toHaveLength(DECREE_CLAUSE_CAP);

    seedDecree(
      distinctClauses(DECREE_CLAUSE_CAP),
      (state) => (state.globalEffectSums.decreeClauseCapBoost = 1),
    );
    expect(inTick(() => decreeClauseAdd({ type: 'ReturnToKingdom' }))).toBe(
      true,
    );
  });
});

describe('decreeClauseConflicts', () => {
  it('flags two clauses of the same type as conflicting regardless of risk tolerance', () => {
    const existing = [
      decreeClause({ type: 'LevelUpParty', riskTolerance: 'Low' }),
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
      decreeClause({ type: 'LevelUpParty', riskTolerance: 'Medium' }),
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
      decreeClause({
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

  it('does not flag GatherMaterial clauses for the same material at different pinned locations', () => {
    const existing = [
      decreeClause({
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        nodeName: 'Grove',
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'GatherMaterial',
          materialId: 'wood' as MaterialId,
          nodeName: 'Old Forest',
          targetQuantity: 20,
        },
        existing,
      ),
    ).toBe(false);
  });

  it('flags two GatherMaterial clauses for the same material at the same pinned location', () => {
    const existing = [
      decreeClause({
        type: 'GatherMaterial',
        materialId: 'wood' as MaterialId,
        nodeName: 'Grove',
        targetQuantity: 100,
      }),
    ];

    expect(
      decreeClauseConflicts(
        {
          type: 'GatherMaterial',
          materialId: 'wood' as MaterialId,
          nodeName: 'Grove',
          targetQuantity: 20,
        },
        existing,
      ),
    ).toBe(true);
  });

  it('does not flag GatherMaterial clauses for different materials', () => {
    const existing = [
      decreeClause({
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
      decreeClause({
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
      decreeClause({
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
      decreeClause({
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
      decreeClause({
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
      decreeClause({ type: 'DefendTowns', riskTolerance: 'Low' }),
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
      decreeClause({
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
  it('toggles only the matching clause', () => {
    seedDecree([
      withId('a', { type: 'ReturnToKingdom' }),
      withId('b', { type: 'LevelUpParty', riskTolerance: 'Low' }),
    ]);

    inTick(() => decreeClauseSetEnabled('a' as DecreeClauseId, false));

    expect(decreeClauses().map((clause) => clause.enabled)).toEqual([
      false,
      true,
    ]);
  });
});

describe('decreeClauseReorder', () => {
  it('moves a clause to a new position', () => {
    seedDecree(distinctClauses(3));

    inTick(() => decreeClauseReorder(0, 2));

    expect(clauseIds()).toEqual(['clause-1', 'clause-2', 'clause-0']);
  });

  it('ignores a move from a position with no clause', () => {
    seedDecree(distinctClauses(2));

    inTick(() => decreeClauseReorder(5, 0));

    expect(clauseIds()).toEqual(['clause-0', 'clause-1']);
  });
});

describe('pruneInvalidDecreeGatherClauses', () => {
  it('drops gather clauses for materials no node produces, leaving other clauses', () => {
    const gather = (materialId: string) =>
      withId(materialId, {
        type: 'GatherMaterial',
        materialId: materialId as MaterialId,
        targetQuantity: 1000,
      });
    const goHome = decreeClause({ type: 'ReturnToKingdom' });

    expect(
      pruneInvalidDecreeGatherClauses(
        [gather('wergen-stick'), gather('copper-ore'), goHome],
        ['copper-ore' as MaterialId],
      ),
    ).toEqual([gather('copper-ore'), goHome]);
  });
});

describe('backfillDecreeClauseRiskTolerance', () => {
  // Saved before clauses carried their own risk tolerance.
  const legacy = (type: 'LevelUpParty' | 'FinishUnfinishedAreas') =>
    ({ id: type, type, enabled: true, failureCount: 0 }) as DecreeClause;

  it('gives risk-aware clauses missing a tolerance the legacy one', () => {
    expect(
      backfillDecreeClauseRiskTolerance(
        [legacy('LevelUpParty'), legacy('FinishUnfinishedAreas')],
        'Low',
      ).map((clause) =>
        'riskTolerance' in clause ? clause.riskTolerance : undefined,
      ),
    ).toEqual(['Low', 'Low']);
  });

  it('keeps an existing tolerance, and leaves other clause types alone', () => {
    const clauses = [
      decreeClause({ type: 'LevelUpParty', riskTolerance: 'Low' }),
      decreeClause({ type: 'ReturnToKingdom' }),
    ];

    expect(backfillDecreeClauseRiskTolerance(clauses, 'High')).toEqual(clauses);
  });
});
