import { getEntry } from '@helpers/content/content';
import { rngUuid } from '@helpers/rng';
import { worldPartyState } from '@helpers/state-game';
import type {
  Character,
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
