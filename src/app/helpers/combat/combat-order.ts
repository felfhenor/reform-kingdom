import { getEntry } from '@helpers/content/content';
import { rngUuid } from '@helpers/rng';
import { worldPartyState } from '@helpers/state-game';
import type {
  CharacterId,
  CombatOrderClause,
  CombatOrderClauseId,
  JobContent,
  JobId,
} from '@interfaces';
import { cloneDeep } from 'es-toolkit/compat';

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

export function combatOrdersFromJobDefaults(jobId: JobId): CombatOrderClause[] {
  const job = getEntry<JobContent>(jobId);
  return (job?.defaultCombatOrders ?? []).map((order) => ({
    id: rngUuid() as CombatOrderClauseId,
    enabled: true,
    condition: cloneDeep(order.condition),
    action: cloneDeep(order.action),
  }));
}
