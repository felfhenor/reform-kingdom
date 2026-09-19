import { worldPartyState } from '@helpers/state-game';
import type { CharacterId, CombatOrderClause, JobId } from '@interfaces';

export function combatOrderClauses(
  characterId: CharacterId,
  jobId: JobId,
): CombatOrderClause[] {
  const character = worldPartyState().find((c) => c.id === characterId);
  return character?.combatOrders[jobId] ?? [];
}
