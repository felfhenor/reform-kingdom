import { describe, expect, it } from 'vitest';

import {
  combatOrderClauseUsesUnknownFamily,
  combatOrderClauses,
  combatOrdersFromJobDefaults,
} from '@helpers/combat/combat-order';
import { ensureJob } from '@helpers/content/ensure-job';
import type {
  CharacterId,
  CombatOrderClause,
  CombatOrderClauseId,
  JobDefaultCombatOrder,
  JobId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const warrior = 'warrior' as JobId;
const ranger = 'ranger' as JobId;
const clause: CombatOrderClause = {
  id: 'clause-1' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'RandomSkill' },
};

describe('combatOrderClauses', () => {
  it('reads a party member’s orders for a job, empty for another job or a missing hero', () => {
    const hero = buildCharacter({ combatOrders: { [warrior]: [clause] } });
    seedGamestate((state) => (state.world.party = [hero]));

    expect(combatOrderClauses(hero.id, warrior)).toEqual([clause]);
    expect(combatOrderClauses(hero.id, ranger)).toEqual([]);
    expect(combatOrderClauses('missing' as CharacterId, warrior)).toEqual([]);
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
