import { gamestate } from '@helpers/state-game';
import type { CharacterId, CombatOrderClause, JobId } from '@interfaces';

export function combatOrderClauses(
  characterId: CharacterId,
  jobId: JobId,
): CombatOrderClause[] {
  const character = gamestate().world.party.find((c) => c.id === characterId);
  return character?.combatOrders[jobId] ?? [];
}
