import { COMBAT_ORDER_ROW_CAP } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { rngUuid } from '@helpers/rng';
import type {
  Character,
  CombatOrderAction,
  CombatOrderClause,
  CombatOrderClauseId,
  CombatOrderCondition,
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

export function combatOrdersMostEnabled(characters: Character[]): number {
  const counts = characters.flatMap((character) =>
    Object.values(character.combatOrders).map(
      (clauses) => (clauses ?? []).filter((clause) => clause.enabled).length,
    ),
  );
  return Math.max(0, ...counts);
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

// A job never held before starts with its defaults; an existing (even emptied) list is the player's own.
export function combatOrdersWithJobDefaults(
  combatOrders: Character['combatOrders'],
  jobId: JobId,
): Character['combatOrders'] {
  return combatOrders[jobId]
    ? combatOrders
    : { ...combatOrders, [jobId]: combatOrdersFromJobDefaults(jobId) };
}

// A clause casting a family the hero no longer knows; switched off rather than deleted so re-learning it is one click.
export function combatOrderClauseUsesUnknownFamily(
  clause: CombatOrderClause,
  knownFamilies: string[],
): boolean {
  return (
    clause.action.type === 'CastSkillFamily' &&
    !knownFamilies.includes(clause.action.family)
  );
}

export function combatOrderClausesAdd(
  clauses: CombatOrderClause[],
  condition: CombatOrderCondition,
  action: CombatOrderAction,
): CombatOrderClause[] {
  if (clauses.length >= COMBAT_ORDER_ROW_CAP) return clauses;

  const id = rngUuid() as CombatOrderClauseId;
  return [{ id, enabled: true, condition, action }, ...clauses];
}

export function combatOrderClausesUpdate(
  clauses: CombatOrderClause[],
  clauseId: CombatOrderClauseId,
  condition: CombatOrderCondition,
  action: CombatOrderAction,
): CombatOrderClause[] {
  return clauses.map((clause) =>
    clause.id === clauseId ? { ...clause, condition, action } : clause,
  );
}

export function combatOrderClausesRemove(
  clauses: CombatOrderClause[],
  clauseId: CombatOrderClauseId,
): CombatOrderClause[] {
  return clauses.filter((clause) => clause.id !== clauseId);
}

export function combatOrderClausesSetEnabled(
  clauses: CombatOrderClause[],
  clauseId: CombatOrderClauseId,
  enabled: boolean,
): CombatOrderClause[] {
  return clauses.map((clause) =>
    clause.id === clauseId ? { ...clause, enabled } : clause,
  );
}

export function combatOrderClausesReorder(
  clauses: CombatOrderClause[],
  fromIndex: number,
  toIndex: number,
): CombatOrderClause[] {
  const reordered = [...clauses];
  const [moved] = reordered.splice(fromIndex, 1);
  if (!moved) return clauses;

  reordered.splice(toIndex, 0, moved);
  return reordered;
}
