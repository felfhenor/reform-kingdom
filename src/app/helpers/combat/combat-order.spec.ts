import { describe, expect, it } from 'vitest';

import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { COMBAT_ORDER_ROW_CAP } from '@helpers/config';
import {
  combatOrderClauseUsesUnknownFamily,
  combatOrderClausesAdd,
  combatOrderClausesRemove,
  combatOrderClausesReorder,
  combatOrderClausesSetEnabled,
  combatOrderClausesUpdate,
  combatOrdersFromJobDefaults,
  combatOrdersMostEnabled,
  combatOrdersWithJobDefaults,
} from '@helpers/combat/combat-order';
import { ensureJob } from '@helpers/content/ensure-job';
import type {
  CombatOrderClause,
  CombatOrderClauseId,
  JobDefaultCombatOrder,
  JobId,
} from '@interfaces';

const warrior = 'warrior' as JobId;
const ranger = 'ranger' as JobId;
const clause: CombatOrderClause = {
  id: 'clause-1' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'RandomSkill' },
};

describe('combatOrdersMostEnabled', () => {
  it('takes the best single job across heroes, ignoring disabled clauses', () => {
    const disabled = { ...clause, enabled: false };
    const heroA = buildCharacter({
      combatOrders: { [warrior]: [clause, disabled], [ranger]: [clause] },
    });
    const heroB = buildCharacter({
      combatOrders: { [warrior]: [clause, clause, disabled] },
    });

    expect(combatOrdersMostEnabled([heroA, heroB])).toBe(2);
    expect(combatOrdersMostEnabled([])).toBe(0);
  });
});

describe('combatOrdersFromJobDefaults', () => {
  const order: JobDefaultCombatOrder = {
    condition: { type: 'EnemyCount', comparator: 'Equal', count: 2 },
    action: { type: 'CastSkillFamily', family: 'Double Strike' },
  };

  it('turns the job defaults into enabled clauses with unique ids', () => {
    seedContent([
      ensureJob({
        id: warrior,
        name: 'Warrior',
        defaultCombatOrders: [order, order],
      }),
    ]);

    const clauses = combatOrdersFromJobDefaults(warrior);

    expect(clauses).toEqual([
      { ...order, id: expect.any(String), enabled: true },
      { ...order, id: expect.any(String), enabled: true },
    ]);
    expect(clauses[0].id).not.toBe(clauses[1].id);
  });

  it('is empty for a job missing from content', () => {
    seedContent([]);

    expect(combatOrdersFromJobDefaults(ranger)).toEqual([]);
  });
});

describe('combatOrdersWithJobDefaults', () => {
  const order: JobDefaultCombatOrder = {
    condition: { type: 'Always' },
    action: { type: 'RandomSkill' },
  };

  it('seeds a job with no orders yet, leaving set (even emptied) jobs alone', () => {
    seedContent([
      ensureJob({ id: warrior, name: 'Warrior', defaultCombatOrders: [order] }),
      ensureJob({ id: ranger, name: 'Ranger', defaultCombatOrders: [order] }),
    ]);
    const orders = { [ranger]: [] };

    expect(combatOrdersWithJobDefaults(orders, warrior)).toEqual({
      [ranger]: [],
      [warrior]: [{ ...order, id: expect.any(String), enabled: true }],
    });
    expect(combatOrdersWithJobDefaults(orders, ranger)).toBe(orders);
  });
});

describe('combatOrderClauseUsesUnknownFamily', () => {
  const clause = (action: CombatOrderClause['action']): CombatOrderClause => ({
    id: 'c' as CombatOrderClauseId,
    enabled: true,
    condition: { type: 'Always' },
    action,
  });

  it('flags only a cast of a family the hero does not know', () => {
    const cast = clause({ type: 'CastSkillFamily', family: 'Strike' });

    expect(combatOrderClauseUsesUnknownFamily(cast, ['Guard'])).toBe(true);
    expect(combatOrderClauseUsesUnknownFamily(cast, ['Strike'])).toBe(false);
    expect(
      combatOrderClauseUsesUnknownFamily(clause({ type: 'RandomSkill' }), []),
    ).toBe(false);
  });
});

describe('combat order clause list edits', () => {
  const second: CombatOrderClause = {
    ...clause,
    id: 'clause-2' as CombatOrderClauseId,
  };
  const ids = (clauses: CombatOrderClause[]) => clauses.map((c) => c.id);

  it('adds an enabled clause with a fresh id at the front', () => {
    const next = combatOrderClausesAdd(
      [clause],
      { type: 'SelfHasNoSummon' },
      clause.action,
    );

    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({
      enabled: true,
      condition: { type: 'SelfHasNoSummon' },
    });
    expect(next[0].id).not.toBe(clause.id);
    expect(next[1]).toBe(clause);
  });

  it('returns the same list when adding at the row cap', () => {
    const full = Array.from({ length: COMBAT_ORDER_ROW_CAP }, (_, i) => ({
      ...clause,
      id: `c${i}` as CombatOrderClauseId,
    }));

    expect(combatOrderClausesAdd(full, clause.condition, clause.action)).toBe(
      full,
    );
  });

  it('updates condition and action in place, keeping id, enabled and position', () => {
    const disabled = { ...second, enabled: false };
    const next = combatOrderClausesUpdate(
      [clause, disabled],
      second.id,
      { type: 'SelfHasNoSummon' },
      clause.action,
    );

    expect(next[0]).toBe(clause);
    expect(next[1]).toEqual({
      ...disabled,
      condition: { type: 'SelfHasNoSummon' },
    });
  });

  it('removes by id', () => {
    expect(ids(combatOrderClausesRemove([clause, second], clause.id))).toEqual([
      second.id,
    ]);
  });

  it('toggles only the matching clause', () => {
    const next = combatOrderClausesSetEnabled(
      [clause, second],
      second.id,
      false,
    );

    expect(next[0]).toBe(clause);
    expect(next[1]).toEqual({ ...second, enabled: false });
  });

  it('moves a clause, ignoring an index past the end', () => {
    const list = [clause, second];

    expect(ids(combatOrderClausesReorder(list, 0, 1))).toEqual([
      second.id,
      clause.id,
    ]);
    expect(combatOrderClausesReorder(list, 5, 0)).toBe(list);
  });
});
