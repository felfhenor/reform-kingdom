import { describe, expect, it } from 'vitest';

import { combatOrderClauses } from '@helpers/combat/combat-order';
import type {
  CharacterId,
  CombatOrderClause,
  CombatOrderClauseId,
  JobId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
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
