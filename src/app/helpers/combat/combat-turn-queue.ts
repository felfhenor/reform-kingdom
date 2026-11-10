import { combatantIsDead } from '@helpers/combat/combat-combatant-hp';
import type { Combat, Combatant, CombatTurn } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export function orderCombatantsByAgility(combat: Combat): Combatant[] {
  return sortBy(
    [...combat.guardians, ...combat.heroes, ...combat.helpers],
    (c) => -c.totalStats.Agility,
  );
}

// An ambush round is a free one for the living heroes only.
export function combatRoundQueue(combat: Combat): CombatTurn[] {
  const order = orderCombatantsByAgility(combat);
  const actors = combat.ambushedBy
    ? order.filter((c) => combat.heroes.includes(c) && !combatantIsDead(c))
    : order;
  return actors.map((c) => ({ combatantId: c.id }));
}

// Undefined once a summon has been replaced since the round began.
export function combatTurnCombatant(
  combat: Combat,
  turn: CombatTurn,
): Combatant | undefined {
  return [...combat.guardians, ...combat.heroes, ...combat.helpers].find(
    (c) => c.id === turn.combatantId,
  );
}
