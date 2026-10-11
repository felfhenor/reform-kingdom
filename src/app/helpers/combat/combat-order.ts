import { worldPartyState } from '@helpers/state-game';
import type {
  CharacterId,
  CombatOrderClause,
  CombatOrderClauseId,
  JobId,
} from '@interfaces';

// The mandatory trailing fallback row - not a real stored clause, shown read-only after a hero's orders.
export const COMBAT_ORDER_ALWAYS_RANDOM_CLAUSE: CombatOrderClause = {
  id: 'always-random-fallback' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'RandomSkill' },
};

export function combatOrderClauses(
  characterId: CharacterId,
  jobId: JobId,
): CombatOrderClause[] {
  const character = worldPartyState().find((c) => c.id === characterId);
  return character?.combatOrders[jobId] ?? [];
}
